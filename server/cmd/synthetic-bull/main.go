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
	"github.com/GC-OpenSoft-2026/Algorithmic-Trading-Simulator/internal/storage"
	"github.com/GC-OpenSoft-2026/Algorithmic-Trading-Simulator/internal/utils/response"
	"github.com/coder/websocket"
)

// Global channels
var orderStream = make(chan models.Order, 10000)
var tradeStream = make(chan models.TradeMessage, 10000)
var lobStream = make(chan models.LOBSnapshot, 500)
var tickerTape = make(chan float64, 1000)

// Store is the global financial-data store (TimescaleDB + Redis)
var store *storage.Store

// --------------------
// Routes
// --------------------

func pingHandler(w http.ResponseWriter, r *http.Request) {
	response.WriteJson(w, http.StatusOK, response.GeneralSuccess("pong", nil))
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	response.WriteJson(w, http.StatusOK, response.GeneralSuccess("healthy", time.Now()))
}

func handleOrder(w http.ResponseWriter, r *http.Request) {
	var req models.Order

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.WriteJson(w, http.StatusBadRequest, response.GeneralError("Invalid JSON", err))
		return
	}

	if req.ID == "" || req.Quantity <= 0 {
		response.WriteJson(w, http.StatusBadRequest, response.GeneralError("Missing ID or invalid Quantity", nil))
		return
	}

	// Persist order to Redis before sending to engine
	if store != nil {
		store.InsertOrder(req)
	}

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
// WebSocket Handler (echo stub)
// --------------------

func wsHandler(w http.ResponseWriter, r *http.Request) {
	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{
		InsecureSkipVerify: true,
	})
	if err != nil {
		log.Println("WS accept error:", err)
		return
	}
	defer conn.Close(websocket.StatusInternalError, "internal error")

	ctx := r.Context()
	log.Println("Client connected")

	for {
		_, msg, err := conn.Read(ctx)
		if err != nil {
			log.Println("Read error:", err)
			break
		}
		log.Printf("Received: %s\n", string(msg))
		if err := conn.Write(ctx, websocket.MessageText, msg); err != nil {
			log.Println("Write error:", err)
			break
		}
	}

	conn.Close(websocket.StatusNormalClosure, "bye")
	log.Println("Client disconnected")
}

// --------------------
// Main
// --------------------

func main() {
	log.Println("=====================================================")
	log.Println("🚀 STARTING ALGORITHMIC TRADING SIMULATOR")
	log.Println("=====================================================")

	// 1. Load config
	cfg, err := config.LoadConfig()
	if err != nil {
		log.Fatal("Failed to load configuration:", err)
	}

	// 2. Init databases (Postgres, TimescaleDB, Redis)
	dbConnections, err := database.Init(cfg)
	if err != nil {
		log.Fatal("Failed to initialize databases:", err)
	}

	// 3. FIX: Run schema migration BEFORE creating the Store.
	//    Previously NewStore was called first, meaning the store could be used
	//    against a database with no tables. Schema must exist before the Store.
	if err := storage.InitSchema(dbConnections.Candlestick); err != nil {
		log.Fatal("Failed to init storage schema:", err)
	}
	store = storage.NewStore(dbConnections.Candlestick, dbConnections.Redis)

	apphandlers := handlers.New(dbConnections, orderStream)
	r := api.SetupRouter(apphandlers)

	log.Println("Initializing the Backend and Simulations...")

	// 4. Start matching engine
	engine := matching.NewEngine(orderStream, tradeStream, lobStream)
	go engine.Start()

	// 5. LOB snapshot pipeline — storage owns lobStream only
	store.StartPipeline(lobStream)

	// 6. Single trade consumer — owns tradeStream exclusively.
	//    FIX: store.HandleTrade is now called here so every matched trade is
	//    persisted to TimescaleDB and written to the Redis candle + ring buffer.
	//    Previously this goroutine only logged, published a fake Redis payload,
	//    and fed tickerTape — HandleTrade was never called, so nothing was stored.
	go func() {
		for trade := range tradeStream {
			log.Printf("✅ [TRADE EXECUTED] %s & %s | %d shares of %s @ ₹%.2f",
				trade.MakerOrderID, trade.TakerOrderID, trade.Quantity, trade.Symbol, trade.Price)

			// Persist trade to TimescaleDB + update Redis candle + ring buffer
			store.HandleTrade(trade)

			// Publish real-time trade event for WebSocket subscribers
			payload, _ := json.Marshal(trade)
			dbConnections.Redis.Publish(
				context.Background(),
				"trades:"+trade.Symbol,
				payload,
			)

			// Feed tickerTape for noise trader (non-blocking)
			select {
			case tickerTape <- trade.Price:
			default:
			}
		}
	}()

	// 7. GBM Market Manager
	marketManager := gbm.NewMarketManager()
	symbol := "TECH"
	marketManager.AddAsset(symbol, "BLUE_CHIP", 100.00)

	time.Sleep(50 * time.Millisecond)

	// 8. Synthetic Market Maker
	marketMaker := synthetic.NewMarketMaker(marketManager, orderStream)
	go marketMaker.Start([]string{symbol}, 100*time.Millisecond)

	// 9. Noise Trader
	noiseTrader := noise.NewAgent(marketManager, orderStream, tickerTape)
	go noiseTrader.Start([]string{symbol}, 8*time.Hour)

	// 10. GBM fair value diagnostics
	go func() {
		ticker := time.NewTicker(1 * time.Second)
		defer ticker.Stop()
		for range ticker.C {
			price := marketManager.GetPrice(symbol)
			log.Printf("📊 [GBM FAIR VALUE] %s: ₹%.4f", symbol, price)
		}
	}()

	// 11. Register routes
	r.Get("/ping", pingHandler)
	r.Get("/health", healthHandler)
	r.Get("/ws", wsHandler)
	r.Post("/order", handleOrder)

	// 12. HTTP server
	address := ":" + strconv.Itoa(cfg.Server.Port)
	server := &http.Server{
		Addr:         address,
		Handler:      r,
		ReadTimeout:  5 * time.Second,
		WriteTimeout: 10 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

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

	marketManager.RemoveAsset(symbol)
	time.Sleep(200 * time.Millisecond)
	log.Println("Exchange offline.")

	slog.Info("Shutting down API server...")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		slog.Error("Server shutdown error:", slog.String("error", err.Error()))
	}
	slog.Info("Server stopped gracefully. Goodbye!")
}
