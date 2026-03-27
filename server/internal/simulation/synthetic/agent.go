package synthetic

import (
	"fmt"
	"math"
	"math/rand"
	"sync"
	"time"

	"github.com/GC-OpenSoft-2026/Algorithmic-Trading-Simulator/internal/models"
	"github.com/GC-OpenSoft-2026/Algorithmic-Trading-Simulator/internal/simulation/gbm"
)

// MarketMaker bridges the math engine and the matching engine
type MarketMaker struct {
	manager     *gbm.MarketManager
	orderStream chan<- models.Order
	
	// Tracks active order IDs so we can cancel them when the price moves
	activeOrders map[string][]models.Order
	mu           sync.Mutex
	idCounter    int64
}

// NewMarketMaker initializes the bot
func NewMarketMaker(manager *gbm.MarketManager, orderStream chan<- models.Order) *MarketMaker {
	rand.Seed(time.Now().UnixNano())
	return &MarketMaker{
		manager:      manager,
		orderStream:  orderStream,
		activeOrders: make(map[string][]models.Order),
	}
}

// Start tracks specific symbols and updates their order books continuously
func (mm *MarketMaker) Start(symbols []string, tickRate time.Duration) {
	ticker := time.NewTicker(tickRate)
	defer ticker.Stop()

	for range ticker.C {
		for _, symbol := range symbols {
			mm.updateOrderBook(symbol)
		}
	}
}

// updateOrderBook cancels the old spread and places a new one around the current fair value
func (mm *MarketMaker) updateOrderBook(symbol string) {
	// 1. Get the current theoretical fair value from the math engine
	fairPrice := mm.manager.GetPrice(symbol)
	if fairPrice == 0 {
		return // Asset doesn't exist yet
	}

	mm.mu.Lock()
	defer mm.mu.Unlock()

	// 2. Cancel the old ladder of orders (so the order book doesn't overflow)
	oldOrders := mm.activeOrders[symbol]
	for _, oldOrder := range oldOrders {
		cancelReq := models.Order{
			ID:    oldOrder.ID,
			Type:  models.Cancel,
			Side:  oldOrder.Side,
			Price: oldOrder.Price,
		}
		mm.orderStream <- cancelReq
	}

	// Clear the list
	mm.activeOrders[symbol] = make([]models.Order, 0)

	// 3. Generate the new ladder
	// We will create 5 levels of depth on both sides
	levels := 5
	tickSize := 0.05 // e.g., prices move in chunks of ₹0.05
	
	// Round the fair price to the nearest tick (e.g., 100.03 becomes 100.05)
	centerPrice := math.Round(fairPrice/tickSize) * tickSize

	for i := 1; i <= levels; i++ {
		qty := int64(rand.Intn(50) + 10) // Random quantity between 10 and 60 shares

		// Generate BIDS (Lower than fair price)
		bidPrice := centerPrice - (float64(i) * tickSize)
		bidOrder := models.Order{
			ID:       mm.generateID("BID"),
			Symbol:   symbol,
			Type:     models.Limit,
			Side:     models.Buy,
			Price:    math.Round(bidPrice*100) / 100, // Round to 2 decimals
			Quantity: qty,
		}
		
		// Generate ASKS (Higher than fair price)
		askPrice := centerPrice + (float64(i) * tickSize)
		askOrder := models.Order{
			ID:       mm.generateID("ASK"),
			Symbol:   symbol,
			Type:     models.Limit,
			Side:     models.Sell,
			Price:    math.Round(askPrice*100) / 100,
			Quantity: qty,
		}

		// Save them to active tracking and send them to the matching engine
		mm.activeOrders[symbol] = append(mm.activeOrders[symbol], bidOrder, askOrder)
		
		mm.orderStream <- bidOrder
		mm.orderStream <- askOrder
	}
}

// generateID creates a quick, unique string ID for the orders
func (mm *MarketMaker) generateID(prefix string) string {
	mm.idCounter++
	return fmt.Sprintf("MM-%s-%d", prefix, mm.idCounter)
}