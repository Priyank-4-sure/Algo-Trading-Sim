package noise

import (
	"fmt"
	// "log"
	"math/rand"
	"time"

	"github.com/GC-OpenSoft-2026/Algorithmic-Trading-Simulator/internal/models"
	"github.com/GC-OpenSoft-2026/Algorithmic-Trading-Simulator/internal/simulation/gbm"
)

// Agent orchestrates the synthetic noise trading logic.
type Agent struct {
	marketManager *gbm.MarketManager
	orderStream   chan models.Order
	tickerTape    <-chan float64 // NEW: Listens to live trades
	rng           *rand.Rand
}

// NewAgent initializes a new Noise Trader Agent.
func NewAgent(manager *gbm.MarketManager, stream chan models.Order, tape <-chan float64) *Agent {
	return &Agent{
		marketManager: manager,
		orderStream:   stream,
		tickerTape:    tape,
		rng:           rand.New(rand.NewSource(time.Now().UnixNano())),
	}
}

// Start begins the synthetic order generation loop.
func (a *Agent) Start(symbols []string, sessionDuration time.Duration) {
	symbol := symbols[0]

	// Configuration
	kSensitivity := 10.0
	contrarianChance := 0.15
	paretoAlpha := 1.16
	minOrderSize := 1.0
	baseDelay := 100 * time.Millisecond
	minDelayLimit := 1 * time.Millisecond

	// Bootstrap the initial state
	startTime := time.Now()
	marketPrice := a.marketManager.GetPrice(symbol) // Use GBM just to start
	lastExecutionPrice := marketPrice

	// Create our event timer instead of using time.Sleep
	delay := CalculateNextDelay(baseDelay, 0.2, 0.0, minDelayLimit)
	fireTimer := time.NewTimer(delay)

	for {
		select {
		// EVENT A: A trade happened on the exchange! Update our known price.
		case livePrice := <-a.tickerTape:
			marketPrice = livePrice 

		// EVENT B: Our delay timer finished! Time to submit an order.
		case <-fireTimer.C:
			// 1. Calculate Progress
			elapsed := time.Since(startTime)
			progress := float64(elapsed) / float64(sessionDuration)
			if progress > 1.0 {
				startTime = time.Now()
				progress = 0.0
			}

			// 2. Mock volatility (can fetch from GBM later)
			currentVolatility := 0.2 

			// 3. Calculate Momentum (\Delta S) against the real market price
			deltaS := 0.0
			if lastExecutionPrice > 0 {
				deltaS = (marketPrice - lastExecutionPrice) / lastExecutionPrice
			}

			// 4. Generate Order
			side := DetermineOrderSide(a.rng, deltaS, kSensitivity, contrarianChance)
			quantity := GenerateOrderSize(a.rng, paretoAlpha, minOrderSize)

			order := models.Order{
				ID:        generateOrderID(),
				Symbol:    symbol,
				Side:      models.Side(side),
				Quantity:  quantity,
				Type:      models.Market,
				Timestamp: time.Now().UnixNano(),
			}
			
			// 5. Fire Order
			select {
			case a.orderStream <- order:
				// log.Printf("🌪️ [NOISE TRADER] Fired %s MARKET order for %d shares of %s (Reacting to Price: ₹%.2f)", order.Side, order.Quantity, order.Symbol, marketPrice)
			default:
				// Drop if engine is completely backed up
			}

			// 6. Update state and reset timer for the next order
			lastExecutionPrice = marketPrice
			
			nextDelay := CalculateNextDelay(baseDelay, currentVolatility, progress, minDelayLimit)
			fireTimer.Reset(nextDelay)
		}
	}
}

func generateOrderID() string {
	return fmt.Sprintf("NOISE-%d", time.Now().UnixNano())
}