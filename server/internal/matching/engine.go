package matching

import (
	"log"
	"time"

	"github.com/GC-OpenSoft-2026/Algorithmic-Trading-Simulator/internal/models"
)

// Engine holds the HFT Limit Order Books and channels
type Engine struct {
	Books        map[string]*OrderBook
	OrderIndex   map[string]OrderIndex // Per-symbol O(1) cancel index (from orderqueue.go)
	OrderStream  <-chan models.Order
	TradeStream  chan<- models.TradeMessage
	LOBBroadcast chan<- interface{}
}

// NewEngine initializes the matching engine
func NewEngine(orderStream <-chan models.Order, tradeStream chan<- models.TradeMessage, lobBroadcast chan<- interface{}) *Engine {
	return &Engine{
		Books:        make(map[string]*OrderBook),
		OrderIndex:   make(map[string]OrderIndex),
		OrderStream:  orderStream,
		TradeStream:  tradeStream,
		LOBBroadcast: lobBroadcast,
	}
}

// Start runs an infinite loop waiting for new orders
func (e *Engine) Start() {
	log.Println("HFT Matching Engine Started...")
	for order := range e.OrderStream {
		e.processOrder(order)
	}
}

func (e *Engine) getBook(symbol string) *OrderBook {
	book, exists := e.Books[symbol]
	if !exists {
		book = NewOrderBook()
		e.Books[symbol] = book
		e.OrderIndex[symbol] = NewOrderIndex()
		log.Printf("Created new HFT Order Book for symbol: %s", symbol)
	}
	return book
}

// processOrder routes the order based on its OrderType
func (e *Engine) processOrder(order models.Order) {
	// Give the order a timestamp right as it hits the engine for strict Time priority
	if order.Timestamp == 0 {
		order.Timestamp = time.Now().UnixNano()
	}

	// Validate price doesn't exceed MaxPriceLevel (prevent array out-of-bounds)
	if order.OrderType == models.OrderTypeLimit && order.Price.ToIndex() >= models.MaxPriceLevel {
		log.Printf("[%s] REJECTED: Order %s price %.2f exceeds MaxPriceLevel",
			order.Symbol, order.ID, order.Price.ToFloat64())
		return
	}

	// Fetch the specific order book for this stock
	book := e.getBook(order.Symbol)
	idx := e.OrderIndex[order.Symbol]

	switch order.OrderType {
	case models.OrderTypeLimit:
		e.ProcessLimitOrder(order, book, idx)
	case models.OrderTypeMarket:
		e.processMarketOrder(order, book, idx)
	case models.OrderTypeCancel:
		// O(1) cancel using OrderIndex (from orderqueue.go)
		if node := idx.Lookup(order.ID); node != nil {
			node.Order.IsActive = false
			delete(book.Orders, order.ID)
			idx.Forget(order.ID)
		} else {
			book.CancelOrder(order.ID) // fallback for orders not in index
		}
	}

	// Broadcast LOB snapshot after every order processing
	e.snapshotLOB(order.Symbol, book)
}

// ---------------------------------------------------------
// LIMIT ORDER PROCESSING (TIF-aware)
// ---------------------------------------------------------

// ProcessLimitOrder handles GTC, FOK, and IOC limit orders
func (e *Engine) ProcessLimitOrder(order models.Order, book *OrderBook, idx OrderIndex) {
	// FOK: Check if full fill is possible before executing
	if order.TIF == models.TIFFOK {
		if !book.canFullyFill(order.Side, order.Price, order.Quantity) {
			log.Printf("[%s] FOK order %s rejected — cannot fully fill", order.Symbol, order.ID)
			return
		}
	}

	// Cross against opposing side
	remaining := e.crossQueue(&order, book, idx)

	// Handle remaining quantity based on TIF
	if remaining.GreaterThan(models.Zero) {
		switch order.TIF {
		case models.TIFGTC:
			// Rest the remaining quantity on the book
			order.Quantity = remaining
			if order.Side == models.SideBuy {
				book.Bids.Append(order)
				if queue := book.Bids.Queue.Queues[order.Price.ToIndex()]; queue != nil {
					queueIdx := len(*queue) - 1
					idx.Track(&(*queue)[queueIdx], order.Price.ToIndex(), queueIdx)
				}
			} else {
				book.Asks.Append(order)
				if queue := book.Asks.Queue.Queues[order.Price.ToIndex()]; queue != nil {
					queueIdx := len(*queue) - 1
					idx.Track(&(*queue)[queueIdx], order.Price.ToIndex(), queueIdx)
				}
			}
			book.Orders[order.ID] = &order

		case models.TIFIOC:
			// Cancel remaining — don't add to book
			log.Printf("[%s] IOC order %s — remaining %.0f cancelled",
				order.Symbol, order.ID, remaining.ToFloat64())
		}
		// FOK never reaches here due to the pre-check above
	}

	// OCO: Cancel linked order after this order executes
	if order.OCO != "" {
		if book.CancelOrder(order.OCO) {
			idx.Forget(order.OCO)
			log.Printf("[%s] OCO: Cancelled linked order %s", order.Symbol, order.OCO)
		}
	}
}

// processMarketOrder immediately fills against the best available prices
func (e *Engine) processMarketOrder(order models.Order, book *OrderBook, idx OrderIndex) {
	remaining := e.crossQueue(&order, book, idx)

	if remaining.GreaterThan(models.Zero) {
		log.Printf("[%s] WARNING: Market order %s partially filled. %.0f remaining (No Liquidity)",
			order.Symbol, order.ID, remaining.ToFloat64())
	}
}

// ---------------------------------------------------------
// CROSS QUEUE — Core matching execution
// ---------------------------------------------------------

// crossQueue walks the opposing OrderSide and matches against resting orders.
// Returns the remaining unfilled quantity.
// Uses BestPrice helpers from orderside.go for sorted price traversal.
func (e *Engine) crossQueue(taker *models.Order, book *OrderBook, idx OrderIndex) models.Decimal {
	var opposingSide *OrderSide
	if taker.Side == models.SideBuy {
		opposingSide = book.Asks
	} else {
		opposingSide = book.Bids
	}

	remaining := taker.Quantity

	// Walk through sorted price levels on the opposing side
	pricesToRemove := make([]int, 0)

	for _, priceIdx := range opposingSide.Prices {
		if remaining.Equal(models.Zero) || remaining.LessThan(models.Zero) {
			break
		}

		// Check price compatibility
		levelPrice := models.Decimal{Value: int64(priceIdx), Scale: taker.Price.Scale}

		if taker.OrderType == models.OrderTypeLimit {
			if taker.Side == models.SideBuy && levelPrice.GreaterThan(taker.Price) {
				break // Ask price too high
			}
			if taker.Side == models.SideSell && levelPrice.LessThan(taker.Price) {
				break // Bid price too low
			}
		}

		// Get the queue at this price level
		queue := opposingSide.Queue.Queues[priceIdx]
		if queue == nil {
			continue
		}

		// Match against resting orders (Time priority)
		hasActiveOrders := false
		for i := range *queue {
			maker := &(*queue)[i]

			if !maker.IsActive {
				continue // Skip logically deleted orders
			}

			if remaining.Equal(models.Zero) || remaining.LessThan(models.Zero) {
				hasActiveOrders = true
				break
			}

			tradeQty := models.MinDecimal(remaining, maker.Quantity)

			// Emit TradeMessage
			trade := models.TradeMessage{
				Symbol:        taker.Symbol,
				MakerOrderID:  maker.ID,
				TakerOrderID:  taker.ID,
				MakerUsername: maker.Username,
				TakerUsername: taker.Username,
				TakerSide:     taker.Side,
				Price:         levelPrice.ToFloat64(),
				Quantity:      int64(tradeQty.ToFloat64()),
				Timestamp:     time.Now().UnixNano(),
			}
			e.TradeStream <- trade
			// Muted verbose logging
			// log.Printf("[%s] TRADE: %.0f shares @ $%.2f (maker: %s, taker: %s)",
			// 	taker.Symbol, tradeQty.ToFloat64(), levelPrice.ToFloat64(), maker.ID, taker.ID)

			// Reduce quantities
			remaining = remaining.Sub(tradeQty)
			maker.Quantity = maker.Quantity.Sub(tradeQty)

			// Logically delete fully filled maker orders
			if maker.Quantity.Equal(models.Zero) || maker.Quantity.LessThan(models.Zero) {
				maker.IsActive = false
				delete(book.Orders, maker.ID)
			} else {
				hasActiveOrders = true
			}
		}

		// If no active orders remain at this price level, mark for removal
		if !hasActiveOrders {
			pricesToRemove = append(pricesToRemove, priceIdx)
		}
	}

	// Clean up empty price levels
	for _, priceIdx := range pricesToRemove {
		opposingSide.removePriceSorted(priceIdx)
	}

	return remaining
}

// ---------------------------------------------------------
// LOB SNAPSHOT BROADCASTING
// ---------------------------------------------------------

// LOBSnapshot is the payload sent to WebSocket clients
type LOBSnapshot struct {
	Symbol string          `json:"symbol"`
	Asks   []LOBPriceLevel `json:"asks"`
	Bids   []LOBPriceLevel `json:"bids"`
}

// LOBPriceLevel represents a single price level in the snapshot
type LOBPriceLevel struct {
	Price  float64 `json:"price"`
	Amount float64 `json:"amount"`
	Total  float64 `json:"total"`
}

// snapshotLOB extracts top 15 bids and asks, sends to LOBBroadcast channel
func (e *Engine) snapshotLOB(symbol string, book *OrderBook) {
	// Top 15 Asks (lowest prices first — already sorted by OrderSide)
	asks := make([]LOBPriceLevel, 0, 15)
	var askRunningTotal float64
	for i, priceIdx := range book.Asks.Prices {
		if i >= 15 {
			break
		}
		vol := e.getLevelVolume(book.Asks.Queue.Queues[priceIdx])
		if vol <= 0 {
			continue
		}
		price := models.Decimal{Value: int64(priceIdx), Scale: 2}
		askRunningTotal += vol
		asks = append(asks, LOBPriceLevel{
			Price:  price.ToFloat64(),
			Amount: vol,
			Total:  askRunningTotal,
		})
	}

	// Top 15 Bids (highest prices first — already sorted by OrderSide)
	bids := make([]LOBPriceLevel, 0, 15)
	var bidRunningTotal float64
	for i, priceIdx := range book.Bids.Prices {
		if i >= 15 {
			break
		}
		vol := e.getLevelVolume(book.Bids.Queue.Queues[priceIdx])
		if vol <= 0 {
			continue
		}
		price := models.Decimal{Value: int64(priceIdx), Scale: 2}
		bidRunningTotal += vol
		bids = append(bids, LOBPriceLevel{
			Price:  price.ToFloat64(),
			Amount: vol,
			Total:  bidRunningTotal,
		})
	}

	snapshot := LOBSnapshot{
		Symbol: symbol,
		Asks:   asks,
		Bids:   bids,
	}

	// Non-blocking send to avoid backpressure stalling the engine
	select {
	case e.LOBBroadcast <- snapshot:
	default:
		// Channel full, skip this snapshot
	}
}

// getLevelVolume sums up active order quantities at a price level
func (e *Engine) getLevelVolume(queue *[]models.Order) float64 {
	if queue == nil {
		return 0
	}
	var vol float64
	for _, o := range *queue {
		if o.IsActive {
			vol += o.Quantity.ToFloat64()
		}
	}
	return vol
}
