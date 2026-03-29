package matching

import (
	"log"
	"time"

	"github.com/GC-OpenSoft-2026/Algorithmic-Trading-Simulator/internal/models"
)

// ---- Data Structures ----

type OrderBook struct {
	Bids *OrderSide
	Asks *OrderSide
}

type Engine struct {
	Books       map[string]*OrderBook
	OrderIndex  map[string]*OrderNode
	OrderStream <-chan models.Order
	TradeStream chan<- models.TradeMessage
	LOBStream   chan<- models.LOBSnapshot
}

// ---- Constructor ----

func NewEngine(
	orderStream <-chan models.Order,
	tradeStream chan<- models.TradeMessage,
	lobStream chan<- models.LOBSnapshot,
) *Engine {
	return &Engine{
		Books:       make(map[string]*OrderBook),
		OrderIndex:  make(map[string]*OrderNode),
		OrderStream: orderStream,
		TradeStream: tradeStream,
		LOBStream:   lobStream,
	}
}

// ---- Engine Loop ----

func (e *Engine) Start() {
	log.Println("Matching Engine Started...")
	for order := range e.OrderStream {
		e.processOrder(order)
	}
}

// ---- Order Processing ----

func (e *Engine) processOrder(order models.Order) {
	if order.Timestamp == 0 {
		order.Timestamp = time.Now().UnixNano()
	}
	book := e.getBook(order.Symbol)

	switch order.Type {
	case models.Limit:
		e.matchLimitOrder(order, book)
	case models.Market:
		e.matchMarketOrder(order, book)
	case models.Cancel:
		e.cancelOrder(order, book)
	}

	e.emitLOBSnapshot(order.Symbol, book)
	// e.logOrderBookState(order.Symbol, book)
}

// ---- Book Management ----

func (e *Engine) getBook(symbol string) *OrderBook {
	book, exists := e.Books[symbol]
	if !exists {
		book = &OrderBook{
			Bids: NewOrderSide(true),
			Asks: NewOrderSide(false),
		}
		e.Books[symbol] = book
		log.Printf("Created new Order Book for symbol: %s", symbol)
	}
	return book
}

// ---- Matching Logic ----

func (e *Engine) matchLimitOrder(order models.Order, book *OrderBook) {
	switch order.Side {
	case models.Buy:
		remaining := e.match(order, book.Asks)
		if remaining > 0 {
			order.Quantity = remaining
			book.Bids.Add(order, e.OrderIndex)
		}
	case models.Sell:
		remaining := e.match(order, book.Bids)
		if remaining > 0 {
			order.Quantity = remaining
			book.Asks.Add(order, e.OrderIndex)
		}
	}
}

func (e *Engine) matchMarketOrder(order models.Order, book *OrderBook) {
	switch order.Side {
	case models.Buy:
		remaining := e.match(order, book.Asks)
		if remaining > 0 {
			log.Printf("[%s] Market BUY not fully filled (%d remaining — no liquidity)", order.Symbol, remaining)
		}
	case models.Sell:
		remaining := e.match(order, book.Bids)
		if remaining > 0 {
			log.Printf("[%s] Market SELL not fully filled (%d remaining — no liquidity)", order.Symbol, remaining)
		}
	}
}

func (e *Engine) match(taker models.Order, side *OrderSide) int64 {
	remaining := taker.Quantity

	for remaining > 0 {
		bestPrice, ok := side.BestPrice()
		if !ok {
			break
		}

		if taker.Type == models.Limit {
			if taker.Side == models.Buy && bestPrice > taker.Price {
				break
			}
			if taker.Side == models.Sell && bestPrice < taker.Price {
				break
			}
		}

		queue := side.GetQueue(bestPrice)

		for node := queue.Front(); node != nil && remaining > 0; node = queue.Front() {
			maker := &node.Order
			tradeQty := min(remaining, maker.Quantity)

			e.TradeStream <- models.TradeMessage{
				Symbol:       taker.Symbol,
				MakerOrderID: maker.ID,
				TakerOrderID: taker.ID,
				Price:        bestPrice,
				Quantity:     tradeQty,
				Timestamp:    time.Now().UnixNano(),
			}

			log.Printf("[%s] TRADE: %d shares @ ₹%.2f", taker.Symbol, tradeQty, bestPrice)

			remaining -= tradeQty
			maker.Quantity -= tradeQty

			if maker.Quantity == 0 {
				queue.PopFront()
				delete(e.OrderIndex, maker.ID)
			}
		}

		if queue.Empty() {
			side.RemovePriceLevel(bestPrice)
		}
	}

	return remaining
}

func (e *Engine) cancelOrder(order models.Order, book *OrderBook) {
	node, exists := e.OrderIndex[order.ID]
	if !exists {
		return
	}

	side := book.Asks
	if node.Order.Side == models.Buy {
		side = book.Bids
	}

	price := node.Order.Price
	queue := side.GetQueue(price)
	if queue == nil {
		delete(e.OrderIndex, order.ID)
		return
	}

	queue.Remove(node)
	delete(e.OrderIndex, order.ID)

	if queue.Empty() {
		side.RemovePriceLevel(price)
	}

	log.Printf("Cancelled Order: %s", order.ID)
}

// ---- LOB Snapshot ----

// emitLOBSnapshot builds a public depth snapshot and sends it non-blocking
// to LOBStream → storage.handleLOBSnapshot → Redis orderbook + midprice keys.
// Uses OrderSide.AllPrices() for O(P) BST traversal and VolumeAt() per level.

func (e *Engine) emitLOBSnapshot(symbol string, book *OrderBook) {
	bidPrices := book.Bids.AllPrices(false) // descending: best bid first
	askPrices := book.Asks.AllPrices(true)  // ascending:  best ask first

	bids := make([]models.PriceLevel, 0, len(bidPrices))
	asks := make([]models.PriceLevel, 0, len(askPrices))

	for _, price := range bidPrices {
		vol := book.Bids.VolumeAt(price)
		if vol > 0 {
			bids = append(bids, models.PriceLevel{
				Price:    price,
				Quantity: vol,
			})
		}
	}

	for _, price := range askPrices {
		vol := book.Asks.VolumeAt(price)
		if vol > 0 {
			asks = append(asks, models.PriceLevel{
				Price:    price,
				Quantity: vol,
			})
		}
	}

	var midPrice float64
	if len(bids) > 0 && len(asks) > 0 {
		midPrice = (bids[0].Price + asks[0].Price) / 2.0
	}

	select {
	case e.LOBStream <- models.LOBSnapshot{
		Symbol:   symbol,
		Bids:     bids,
		Asks:     asks,
		MidPrice: midPrice,
	}:
	default:
		// consumer is slow — drop; next order will emit a fresh snapshot
	}
}

// ---- Diagnostics ----

// func (e *Engine) logOrderBookState(symbol string, book *OrderBook) {
// 	// log.Printf("===== LOB STATE: %s =====", symbol)

// 	// Asks: print highest first (reverse the ascending slice)
// 	askPrices := book.Asks.AllPrices(true)
// 	for i := len(askPrices) - 1; i >= 0; i-- {
// 		// price := askPrices[i]
// 		// log.Printf("  ASK: %d shares @ ₹%.2f", book.Asks.VolumeAt(price), price)
// 	}

// 	// log.Printf("  -----------------------")

// 	// Bids: already descending from AllPrices
// 	for _, price := range book.Bids.AllPrices(false) {
// 		log.Printf("  BID: %d shares @ ₹%.2f", book.Bids.VolumeAt(price), price)
// 	}

// 	log.Printf("=========================")
// }


// ---- Helpers ----

func min(a, b int64) int64 {
	if a < b {
		return a
	}
	return b
}

// ---- Time Complexities ----
// Add order:     O(1) existing price level | O(log P) new price level (BST insert)
// Cancel order:  O(1) via OrderIndex lookup
// Match orders:  O(K + L log P) — K trades executed, L price levels traversed
// LOB snapshot:  O(P) — one BST Slice() traversal + O(N) VolumeAt per level
