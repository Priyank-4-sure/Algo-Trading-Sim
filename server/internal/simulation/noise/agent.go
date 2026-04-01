package noise

import (
	"context" // NEW: For graceful shutdown
	"fmt"
	"log"
	"math/rand"
	"time"

	"github.com/GC-OpenSoft-2026/Algorithmic-Trading-Simulator/internal/models"
	"github.com/GC-OpenSoft-2026/Algorithmic-Trading-Simulator/internal/simulation/gbm"
)

type Agent struct {
	marketManager *gbm.MarketManager
	orderStream   chan models.Order
	tickerTape    <-chan models.TradeMessage
	rng           *rand.Rand
}

type symbolState struct {
	marketPrice   float64
	priceEMA      float64 // NEW: Smoothed price for momentum
	nextOrderTime time.Time
}

func NewAgent(manager *gbm.MarketManager, stream chan models.Order, tape <-chan models.TradeMessage) *Agent {
	return &Agent{
		marketManager: manager,
		orderStream:   stream,
		tickerTape:    tape,
		rng:           rand.New(rand.NewSource(time.Now().UnixNano())),
	}
}

// Start now takes a context.Context for graceful shutdowns
func (a *Agent) Start(ctx context.Context, symbols []string, sessionDuration time.Duration) {
	kSensitivity := 10.0
	contrarianChance := 0.15
	paretoAlpha := 1.16
	minOrderSize := 1.0
	baseDelay := 100 * time.Millisecond
	minDelayLimit := 1 * time.Millisecond
	
	// EMA smoothing factor (e.g., 0.1 means new prices have 10% weight)
	alphaEMA := 0.1 

	startTime := time.Now()

	states := make(map[string]*symbolState)
	for _, sym := range symbols {
		startPrice := a.marketManager.GetPrice(sym)
		states[sym] = &symbolState{
			marketPrice:   startPrice,
			priceEMA:      startPrice, // Initialize EMA to starting price
			nextOrderTime: time.Now().Add(CalculateNextDelay(baseDelay, 0.2, 0.0, minDelayLimit)),
		}
	}

	evalTicker := time.NewTicker(10 * time.Millisecond)
	defer evalTicker.Stop()

	for {
		select {
		case <-ctx.Done():
			// Graceful shutdown triggered from main.go
			// log.Println("Noise Trader Agent shutting down...")
			return 

		case trade := <-a.tickerTape:
			if state, exists := states[trade.Symbol]; exists {
				state.marketPrice = trade.Price
				// Update EMA smoothly on every trade: 
				// $EMA_{new} = Price \times \alpha + EMA_{old} \times (1 - \alpha)$
				state.priceEMA = (trade.Price * alphaEMA) + (state.priceEMA * (1.0 - alphaEMA))
			}

		case <-evalTicker.C:
			now := time.Now()
			
			elapsed := now.Sub(startTime)
			progress := float64(elapsed) / float64(sessionDuration)
			if progress > 1.0 {
				startTime = now
				progress = 0.0
			}

			for sym, state := range states {
				if now.After(state.nextOrderTime) {
					currentVolatility := a.marketManager.GetVolatility(sym)

					// Calculate Momentum against the smoothed EMA, not the last execution
					deltaS := 0.0
					if state.priceEMA > 0 {
						deltaS = (state.marketPrice - state.priceEMA) / state.priceEMA
					}

					side := DetermineOrderSide(a.rng, deltaS, kSensitivity, contrarianChance)
					quantity := GenerateOrderSize(a.rng, paretoAlpha, minOrderSize)

					// 70% chance to place a Market Order, 30% chance for a Limit Order
					orderType := models.Market
					orderPrice := 0.0

					if a.rng.Float64() > 0.70 {
						orderType = models.Limit
						// Add a tiny random offset to the current price for the limit order
						offset := state.marketPrice * 0.001 * a.rng.NormFloat64()
						orderPrice = state.marketPrice + offset
					}

					order := models.Order{
						ID:        generateOrderID(sym),
						Symbol:    sym,
						Side:      models.Side(side),
						Quantity:  quantity,
						Type:      orderType,
						Price:     orderPrice,
						Timestamp: time.Now().UnixNano(),
					}

					select {
					case a.orderStream <- order:
						log.Printf("🌪️ [NOISE TRADER] Fired %s MARKET order for %d shares of %s (Reacting to Price: ₹%.2f)", order.Side, order.Quantity, order.Symbol, state.marketPrice)
					default:
					}

					// Schedule the NEXT order
					nextDelay := CalculateNextDelay(baseDelay, currentVolatility, progress, minDelayLimit)
					state.nextOrderTime = now.Add(nextDelay)
				}
			}
		}
	}
}

func generateOrderID(symbol string) string {
	return fmt.Sprintf("NOISE-%s-%d", symbol, time.Now().UnixNano())
}