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

const MarketMakerUserID uint = 999999998 // Reserved high-ID to prevent PostgreSQL collisions

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

// updateOrderBook cancels the old spread and places a dynamically jittered ladder
func (mm *MarketMaker) updateOrderBook(symbol string) {
	// 1. Get the current theoretical fair value from the math engine
	fairPrice := mm.manager.GetPrice(symbol)
	if fairPrice <= 0 {
		return // Asset doesn't exist yet
	}

	mm.mu.Lock()
	defer mm.mu.Unlock()

	// 2. Cancel the old ladder of orders
	oldOrders := mm.activeOrders[symbol]
	for _, oldOrder := range oldOrders {
		cancelReq := models.Order{
			ID:     oldOrder.ID,
			Type:   models.Cancel,
			Side:   oldOrder.Side,
			Price:  oldOrder.Price,
			Symbol: symbol,
		}
		mm.orderStream <- cancelReq
	}

	mm.activeOrders[symbol] = make([]models.Order, 0)

	// 3. Dynamic Tick Sizing using Basis Points (bps)
	// Let's set the base tick size to 5 Basis Points (0.05% of the asset's current price)
	baseTickPct := 0.0001
	tickSize := fairPrice * baseTickPct

	// 4. Spread Breathing (Jitter)
	// The spread randomly expands between 1.0x and 2.5x the base tick size
	spreadMultiplier := 1.0 + (rand.Float64() * 1.5)
	halfSpread := (tickSize * spreadMultiplier) / 2.0

	// Set the starting Best Bid and Best Ask
	currentBidPrice := fairPrice - halfSpread
	currentAskPrice := fairPrice + halfSpread

	// 5. Asymmetric Ladder Generation
	// Randomize the depth between 4 and 10 levels
	levels := rand.Intn(7) + 4

	for i := 0; i < levels; i++ {
		// Randomize quantity with a fat-tail bias (some levels have low volume, some high)
		baseQty := float64(rand.Intn(40) + 10)
		qtyMultiplier := 1.0
		if rand.Float64() > 0.8 {
			qtyMultiplier = 3.0 // 20% chance for a "thick" price level
		}
		qty := int64(baseQty * qtyMultiplier)

		// Generate BID
		bidOrder := models.Order{
			ID:       mm.generateID("BID"),
			UserID:   MarketMakerUserID, // Injected User ID
			Symbol:   symbol,
			Type:     models.Limit,
			Side:     models.Buy,
			Price:    math.Round(currentBidPrice*100) / 100, // Round to 2 decimals
			Quantity: qty,
		}

		// Generate ASK
		askOrder := models.Order{
			ID:       mm.generateID("ASK"),
			UserID:   MarketMakerUserID, // Injected User ID
			Symbol:   symbol,
			Type:     models.Limit,
			Side:     models.Sell,
			Price:    math.Round(currentAskPrice*100) / 100,
			Quantity: qty,
		}

		// Save them to active tracking and send them to the matching engine
		mm.activeOrders[symbol] = append(mm.activeOrders[symbol], bidOrder, askOrder)

		mm.orderStream <- bidOrder
		mm.orderStream <- askOrder

		// Step the prices further out for the next level in the ladder
		// Gap is randomized between 0.5x and 2.0x the tickSize
		bidGap := tickSize * (0.5 + rand.Float64()*1.5)
		askGap := tickSize * (0.5 + rand.Float64()*1.5)

		currentBidPrice -= bidGap
		currentAskPrice += askGap
	}
}

// generateID creates a quick, unique string ID for the orders
func (mm *MarketMaker) generateID(prefix string) string {
	mm.idCounter++
	return fmt.Sprintf("MM-%s-%d", prefix, mm.idCounter)
}