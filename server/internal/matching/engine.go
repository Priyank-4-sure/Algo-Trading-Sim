package matching

import (
	"log"
	"sort"
	"time"

	"github.com/GC-OpenSoft-2026/Algorithmic-Trading-Simulator/internal/models"
)


// OrderBook represents the Bids and Asks for ONE specific stock
type OrderBook struct {
	// Key is Price. Value is a slice of Orders (queue)
	Bids map[float64][]models.Order // Bids (Buyers)
	Asks map[float64][]models.Order // Asks (Sellers)
}

// Engine holds the Limit Order Book and channels
type Engine struct {
	// Books maps a Symbol (e.g., "TECH") to its specific OrderBook
	Books map[string]*OrderBook

	OrderStream <-chan models.Order       // Reads incoming orders
	TradeStream chan<- models.TradeMessage // Sends out executed trades
}

// NewEngine initializes the matching engine
func NewEngine(orderStream <-chan models.Order, tradeStream chan<- models.TradeMessage) *Engine {
	return &Engine{
		Books:       make(map[string]*OrderBook),
		OrderStream: orderStream,
		TradeStream: tradeStream,
	}
}

// Start runs an infinite loop waiting for new orders
func (e *Engine) Start() {
	log.Println("Matching Engine Started...")
	for order := range e.OrderStream {
		e.processOrder(order)
	}
}

// getBook safely retrieves an OrderBook for a symbol, or creates one if it doesn't exist
func (e *Engine) getBook(symbol string) *OrderBook {
	book, exists := e.Books[symbol]
	if !exists {
		// First time seeing this stock! Create a new book for it.
		book = &OrderBook{
			Bids: make(map[float64][]models.Order),
			Asks: make(map[float64][]models.Order),
		}
		e.Books[symbol] = book
		log.Printf("Created new Order Book for symbol: %s", symbol)
	}
	return book
}

// processOrder routes the order based on its Type
func (e *Engine) processOrder(order models.Order) {
	// Give the order a timestamp right as it hits the engine for strict Time priority
	if order.Timestamp == 0 {
		order.Timestamp = time.Now().UnixNano()
	}

	// Fetch the specific order book for this stock
	book := e.getBook(order.Symbol)

	switch order.Type {
	case models.Limit:
		e.matchLimitOrder(order, book)
	case models.Market:
		e.matchMarketOrder(order, book)
	case models.Cancel:
		e.cancelOrder(order, book)
	}

	// Print the updated Order Book state to the terminal
	// e.logOrderBookState(order.Symbol, book)
}

// ---------------------------------------------------------
// MATCHING LOGIC (Now operates on a specific 'book')
// ---------------------------------------------------------

func (e *Engine) matchLimitOrder(newOrder models.Order, book *OrderBook) {
	remainingQty := newOrder.Quantity

	if newOrder.Side == models.Buy {
		// 1. Find all available Ask prices and sort them Lowest to Highest
		askPrices := e.getSortedPrices(book.Asks, true) // true = ascending

		// 2. Loop through the best prices until the order is filled or prices are too high
		for _, price := range askPrices {
			// Stop if the seller wants more money than the buyer is willing to pay
			if price > newOrder.Price || remainingQty == 0 {
				break
			}

			// 3. Match against the queue at this specific price
			remainingQty = e.crossQueue(&newOrder, remainingQty, price, book.Asks)
		}

		// 4. If the order isn't fully filled, add it to the resting Bids
		if remainingQty > 0 {
			if remainingQty < newOrder.Quantity {
				log.Printf("[%s] WARNING: Limit order %s partially filled. %d shares remaining added to LOB.", newOrder.Symbol, newOrder.ID, remainingQty)
			}
			newOrder.Quantity = remainingQty
			book.Bids[newOrder.Price] = append(book.Bids[newOrder.Price], newOrder)
			log.Printf("[%s] Added to LOB: BUY %d @ ₹%.2f", newOrder.Symbol,remainingQty, newOrder.Price)
		}

	} else if newOrder.Side == models.Sell {
		// Inverse logic for Sellers matching against Buyers
		bidPrices := e.getSortedPrices(book.Bids, false) // false = descending (Highest price first)

		for _, price := range bidPrices {
			// Stop if the buyer is offering less money than the seller wants
			if price < newOrder.Price || remainingQty == 0 {
				break
			}
			remainingQty = e.crossQueue(&newOrder, remainingQty, price, book.Bids)
		}

		if remainingQty > 0 {
			if remainingQty < newOrder.Quantity {
				log.Printf("[%s] WARNING: Limit order %s partially filled. %d shares remaining added to LOB.", newOrder.Symbol, newOrder.ID, remainingQty)
			}
			newOrder.Quantity = remainingQty
			book.Asks[newOrder.Price] = append(
				book.Asks[newOrder.Price], newOrder)
			log.Printf("[%s] Added to LOB: SELL %d @ ₹%.2f", newOrder.Symbol, remainingQty, newOrder.Price)
		}
	}
}

func (e *Engine) matchMarketOrder(newOrder models.Order, book *OrderBook) {
	remainingQty := newOrder.Quantity

	if newOrder.Side == models.Buy {
		// Buy Market orders just eat the cheapest Asks until filled
		askPrices := e.getSortedPrices(book.Asks, true)
		for _, price := range askPrices {
			if remainingQty == 0 {
				break
			}
			remainingQty = e.crossQueue(&newOrder, remainingQty, price, book.Asks)
		}
	} else {
		// Sell Market orders eat the highest Bids until filled
		bidPrices := e.getSortedPrices(book.Bids, false)
		for _, price := range bidPrices {
			if remainingQty == 0 {
				break
			}
			remainingQty = e.crossQueue(&newOrder, remainingQty, price, book.Bids)
		}
	}

	if remainingQty > 0 {
		log.Printf("[%s] WARNING: Market order %s partially filled. %d shares remaining (No Liquidity)", newOrder.Symbol, newOrder.ID, remainingQty)
	}
}

// cancelOrder searches the book and removes the order
func (e *Engine) cancelOrder(cancelReq models.Order, book *OrderBook) {
	sideMap := book.Bids
	if cancelReq.Side == models.Sell {
		sideMap = book.Asks
	}

	queue := sideMap[cancelReq.Price]
	for i, o := range queue {
		if o.ID == cancelReq.ID {
			// Remove the order from the slice (Go slice trick)
			sideMap[cancelReq.Price] = append(queue[:i], queue[i+1:]...)
			log.Printf("Cancelled Order: %s", cancelReq.ID)
			
			// If the queue is now empty, delete the price level entirely
			if len(sideMap[cancelReq.Price]) == 0 {
				delete(sideMap, cancelReq.Price)
			}
			return
		}
	}
}

// ---------------------------------------------------------
// HELPER FUNCTIONS
// ---------------------------------------------------------

// crossQueue executes trades against a specific price level queue
// returns remaining quantity as integer

func (e *Engine) crossQueue(takerOrder *models.Order, remainingQty int64, priceLevel float64, bookSide map[float64][]models.Order) int64 {

	queue := bookSide[priceLevel]

	// Iterate through the orders resting at this price (Time priority)
	for i := 0; i < len(queue); i++ {
		makerOrder := &queue[i]

		if remainingQty == 0 {
			break
		}

		// Calculate how many shares we can trade
		tradeQty := min(remainingQty, makerOrder.Quantity)

		// Create and send the trade message
		trade := models.TradeMessage{
			Symbol:       takerOrder.Symbol, //Track symbol for each trade!
			MakerOrderID: makerOrder.ID,
			TakerOrderID: takerOrder.ID,
			Price:        priceLevel,
			Quantity:     tradeQty,
			Timestamp:    time.Now().UnixNano(),
		}
		e.TradeStream <- trade
		log.Printf("[%s] TRADE: %d shares @ $%.2f",
		takerOrder.Symbol, tradeQty, priceLevel)

		// Reduce quantities
		remainingQty -= tradeQty
		makerOrder.Quantity -= tradeQty
	}

	// Clean up the queue: Remove fully filled orders from the front
	var newQueue []models.Order
	for _, o := range queue {
		if o.Quantity > 0 {
			newQueue = append(newQueue, o)
		}
	}

	// If the queue is empty, delete the price level, else update it
	if len(newQueue) == 0 {
		delete(bookSide, priceLevel)
	} else {
		bookSide[priceLevel] = newQueue
	}

	return remainingQty
}

// getSortedPrices extracts keys from the map and sorts them
func (e *Engine) getSortedPrices(m map[float64][]models.Order, ascending bool) []float64 {
	keys := make([]float64, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}

	sort.Slice(keys, func(i, j int) bool {
		if ascending {
			return keys[i] < keys[j] // Lowest first (for Asks)
		}
		return keys[i] > keys[j] // Highest first (for Bids)
	})

	return keys
}

func min(a, b int64) int64 {
	if a < b {
		return a
	}
	return b
}

// ---------------------------------------------------------
// DIAGNOSTICS & LOGGING
// ---------------------------------------------------------

// logOrderBookState prints the current depth of the Bids and Asks
func (e *Engine) logOrderBookState(symbol string, book *OrderBook) {
	log.Printf("===== LOB STATE: %s =====", symbol)

	// Print Asks (Highest price at the top)
	askPrices := e.getSortedPrices(book.Asks, true)
	for i := len(askPrices) - 1; i >= 0; i-- {
		price := askPrices[i]
		qty := e.getQueueVolume(book.Asks[price])
		log.Printf("  ASK: %d shares @ $%.2f", qty, price)
	}

	log.Printf("  -----------------------")

	// Print Bids (Highest price at the top)
	bidPrices := e.getSortedPrices(book.Bids, false)
	for _, price := range bidPrices {
		qty := e.getQueueVolume(book.Bids[price])
		log.Printf("  BID: %d shares @ $%.2f", qty, price)
	}
	log.Printf("=========================")
}

// getQueueVolume helper to sum up the quantities at a specific price level
func (e *Engine) getQueueVolume(queue []models.Order) int64 {
	var vol int64 = 0
	for _, o := range queue {
		vol += o.Quantity
	}
	return vol
}

// Current Time Complexity:
// - Price Lookup (Map): O(1)
// - Price Sorting (getSortedPrices): O(P log P) where P is active price levels.
// - Queue Execution/Removal (Slice): O(N) where N is queue length.
// Future Optimization Note: To make this significantly faster and avoid O(P log P) sorting,
// we plan to transition to a TreeSet (BST). This will yield O(log P) insertion/deletion
// and O(1) lookup for the best Bid/Ask prices!