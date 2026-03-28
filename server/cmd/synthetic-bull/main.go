package main

import (
	"context"
	"encoding/json"
	"log"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"github.com/GC-OpenSoft-2026/Algorithmic-Trading-Simulator/internal/api"
	"github.com/GC-OpenSoft-2026/Algorithmic-Trading-Simulator/internal/config"
	"github.com/GC-OpenSoft-2026/Algorithmic-Trading-Simulator/internal/database"
	"github.com/GC-OpenSoft-2026/Algorithmic-Trading-Simulator/internal/handlers"
	"github.com/GC-OpenSoft-2026/Algorithmic-Trading-Simulator/internal/matching"
	"github.com/GC-OpenSoft-2026/Algorithmic-Trading-Simulator/internal/models"
	"github.com/GC-OpenSoft-2026/Algorithmic-Trading-Simulator/internal/simulation/gbm"
	"github.com/GC-OpenSoft-2026/Algorithmic-Trading-Simulator/internal/simulation/noise"
	"github.com/GC-OpenSoft-2026/Algorithmic-Trading-Simulator/internal/simulation/synthetic"
	"github.com/GC-OpenSoft-2026/Algorithmic-Trading-Simulator/internal/utils/response"
)

// Global channels (Sized up based on your simulation needs)
var orderStream = make(chan models.Order, 10000)
var tradeStream = make(chan models.TradeMessage, 10000)
var tickerTape = make(chan float64, 1000)

// --------------------
// Routes
// --------------------
func pingHandler(w http.ResponseWriter, r *http.Request) {
	response.WriteJson(w, http.StatusOK, response.GeneralSuccess("pong", nil))
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	response.WriteJson(w, http.StatusOK, response.GeneralSuccess("healthy", time.Now()))
}

// handleOrder receives JSON from the user and pushes it into the Engine
func handleOrder(w http.ResponseWriter, r *http.Request) {
	var req models.Order

	// Parse the JSON body into our Order struct
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.WriteJson(w, http.StatusBadRequest, response.GeneralError("Invalid JSON", err))
		return
	}

	// Validate basic fields
	if req.ID == "" || req.Quantity <= 0 {
		response.WriteJson(w, http.StatusBadRequest, response.GeneralError("Missing ID, Symbol, or Quantity", nil))
		return
	}

	// Push the order into the channel to be processed by the Engine
	orderStream <- req

	response.WriteJson(w, http.StatusAccepted, map[string]interface{}{
		"message":  "Order accepted into queue",
		"order_id": req.ID,
		"symbol":   req.Symbol,
		"status":   "QUEUED",
		"details":  req,
	})
}

// --------------------
// Main
// --------------------
func main() {
	log.Println("=====================================================")
	log.Println("🚀 STARTING ALGORITHMIC TRADING SIMULATOR")
	log.Println("=====================================================")

	// 1. Load Configuration and Initialize Database
	cfg, err := config.LoadConfig()
	if err != nil {
		log.Fatal("Failed to load configuration:", err)
	}

	dbConnections, err := database.Init(cfg)
	if err != nil {
		log.Fatal("Failed to initialize databases:", err)
	}

	apphandlers := handlers.New(dbConnections, orderStream)
	r := api.SetupRouter(apphandlers)

	log.Println("Initializing the Backend and Simulations...")

	// 2. Start the Matching Engine
	engine := matching.NewEngine(orderStream, tradeStream)
	go engine.Start()

	// 3. Start the Trade Consumer (The Ticker Tape Broadcaster)
	// 3. Start the Trade Consumer
	go func() {
		for trade := range tradeStream {
			log.Printf("✅ [TRADE EXECUTED] Match ID: %s & %s | %d shares of %s @ ₹%.2f",
				trade.MakerOrderID, trade.TakerOrderID, trade.Quantity, trade.Symbol, trade.Price)

			// --- NEW: PUBLISH THE TRADE TO REDIS ---
			// We format a fake orderbook payload just for testing the pipe
			priceStr := strconv.FormatFloat(trade.Price, 'f', 2, 64)
			qtyStr := strconv.FormatInt(trade.Quantity, 10)

			fakeUpdate := models.OrderbookUpdate{
				Symbol: trade.Symbol,
				Bids:   [][]string{{priceStr, qtyStr}},
				Asks:   [][]string{},
			}

			payload, _ := json.Marshal(fakeUpdate)

			// Publish to the channel the WebSocket is listening to
			dbConnections.Redis.Publish(context.Background(), "orderbook:"+trade.Symbol, payload)
			// ---------------------------------------

			select {
			case tickerTape <- trade.Price:
			default:
			}
		}
	}()

	// 4. Start the GBM Market Manager (Physics Engine)
	marketManager := gbm.NewMarketManager()
	symbol := "TECH"
	marketManager.AddAsset(symbol, "BLUE_CHIP", 100.00)

	time.Sleep(50 * time.Millisecond) // Let engine bootstrap

	// 5. Start the Synthetic Market Maker (Liquidity Provider)
	marketMaker := synthetic.NewMarketMaker(marketManager, orderStream)
	go marketMaker.Start([]string{symbol}, 100*time.Millisecond)

	// 6. Start the Noise Trader (Retail/Whale Flow)
	noiseTrader := noise.NewAgent(marketManager, orderStream, tickerTape)
	go noiseTrader.Start([]string{symbol}, 8*time.Hour)

	// 7. Watch the Fair Value drift (Diagnostics)
	go func() {
		ticker := time.NewTicker(1 * time.Second)
		defer ticker.Stop()
		for range ticker.C {
			price := marketManager.GetPrice(symbol)
			log.Printf("📊 [GBM FAIR VALUE] %s: ₹%.4f", symbol, price)
		}
	}()

	// 8. Register HTTP/WS Routes
	r.Get("/ping", pingHandler)
	r.Get("/health", healthHandler)
	r.Post("/order", handleOrder)

	// 9. Configure and Start HTTP Server
	address := ":" + strconv.Itoa(cfg.Server.Port)
	server := &http.Server{
		Addr:         address,
		Handler:      r,
		ReadTimeout:  5 * time.Second,
		WriteTimeout: 10 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// 10. Handle Graceful Shutdown
	done := make(chan os.Signal, 1)
	signal.Notify(done, os.Interrupt, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		slog.Info("Server running on http://localhost" + address)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal(err)
		}
	}()

	<-done

	log.Println("\n--- INITIATING SHUTDOWN ---")

	// Shut down simulation components
	marketManager.RemoveAsset(symbol)
	time.Sleep(200 * time.Millisecond)
	log.Println("Exchange offline.")

	// Shut down API Server
	slog.Info("Shutting down API server...")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		slog.Error("Server shutdown error:", slog.String("error", err.Error()))
	}

	slog.Info("Server stopped gracefully. Goodbye!")
}
