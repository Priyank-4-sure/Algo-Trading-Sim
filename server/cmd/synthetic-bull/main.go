// package main

// import (
// 	"context"
// 	"encoding/json"
// 	"log"
// 	"log/slog"
// 	"net/http"
// 	"os"
// 	"os/signal"
// 	"strconv"
// 	"syscall"
// 	"time"

// 	"github.com/GC-OpenSoft-2026/Algorithmic-Trading-Simulator/internal/api"
// 	"github.com/GC-OpenSoft-2026/Algorithmic-Trading-Simulator/internal/config"
// 	"github.com/GC-OpenSoft-2026/Algorithmic-Trading-Simulator/internal/database"
// 	"github.com/GC-OpenSoft-2026/Algorithmic-Trading-Simulator/internal/handlers"
// 	"github.com/coder/websocket"

// 	"github.com/GC-OpenSoft-2026/Algorithmic-Trading-Simulator/internal/matching"
// 	"github.com/GC-OpenSoft-2026/Algorithmic-Trading-Simulator/internal/models"
// 	"github.com/GC-OpenSoft-2026/Algorithmic-Trading-Simulator/internal/utils/response"
// )

// // Global channels
// var orderStream = make(chan models.Order, 1000)
// var tradeStream = make(chan models.TradeMessage, 1000)

// // --------------------
// // Routes
// // --------------------
// func pingHandler(w http.ResponseWriter, r *http.Request) {
// 	response.WriteJson(w, http.StatusOK, response.GeneralSuccess("pong", nil))
// }

// func healthHandler(w http.ResponseWriter, r *http.Request) {
// 	response.WriteJson(w, http.StatusOK, response.GeneralSuccess("healthy", time.Now()))
// }

// // handleOrder receives JSON from the user and pushes it into the Engine
// func handleOrder(w http.ResponseWriter, r *http.Request) {
// 	var req models.Order

// 	// Parse the JSON body into our Order struct
// 	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
// 		response.WriteJson(w, http.StatusBadRequest, response.GeneralError("Invalid JSON", err))
// 		return
// 	}

// 	// Validate basic fields
// 	if req.ID == "" || req.Quantity <= 0 {
// 		response.WriteJson(w, http.StatusBadRequest, response.GeneralError("Missing ID, Symbol, or Quantity", nil))
// 		return
// 	}

// 	// Push the order into the channel to be processed by the Engine
// 	orderStream <- req

// 	response.WriteJson(w, http.StatusAccepted, map[string]interface{}{
// 		"message":  "Order accepted into queue",
// 		"order_id": req.ID,
// 		"symbol":   req.Symbol,
// 		"status":   "QUEUED",
// 		"details":  req,
// 	})
// }

// // --------------------
// // WebSocket Handler
// // --------------------
// func wsHandler(w http.ResponseWriter, r *http.Request) {
// 	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{
// 		// Allow all origins (DEV ONLY — restrict in prod)
// 		InsecureSkipVerify: true,
// 	})
// 	if err != nil {
// 		log.Println("WS accept error:", err)
// 		return
// 	}
// 	defer conn.Close(websocket.StatusInternalError, "internal error")

// 	ctx := context.Background()

// 	log.Println("Client connected")

// 	for {
// 		// Read message
// 		_, msg, err := conn.Read(ctx)
// 		if err != nil {
// 			log.Println("Read error:", err)
// 			break
// 		}

// 		log.Printf("Received: %s\n", string(msg))

// 		// Echo back
// 		err = conn.Write(ctx, websocket.MessageText, msg)
// 		if err != nil {
// 			log.Println("Write error:", err)
// 			break
// 		}
// 	}

// 	conn.Close(websocket.StatusNormalClosure, "bye")
// 	log.Println("Client disconnected")
// }

// // --------------------
// // Main
// // --------------------
// func main() {

// 	cfg, err := config.LoadConfig()
// 	if err != nil {
// 		log.Fatal("Failed to load configuration:", err)
// 	}

// 	dbConnections, err := database.Init(cfg)

// 	if err != nil {
// 		log.Fatal("Failed to initialize databases:", err)
// 	}

// 	apphandlers := handlers.New(dbConnections)

// 	r := api.SetupRouter(apphandlers)

// 	log.Println("Initializing the Backend...")

// 	// Initialize and Start the Matching Engine in the background
// 	engine := matching.NewEngine(orderStream, tradeStream)
// 	go engine.Start()

// 	//Start a simple background worker to log trades as they happen
// 	// (Later, this will be your WebSocket Broadcaster and Aggregator)
// 	go func() {
// 		for trade := range tradeStream {
// 			log.Printf("[TRADE STREAM] [%s] Match ID: %s & %s | Qty: %d | Price: ₹%.2f",
// 				trade.Symbol, trade.MakerOrderID, trade.TakerOrderID, trade.Quantity, trade.Price)
// 		}
// 	}()

// 	// Routes
// 	r.Get("/ping", pingHandler)
// 	r.Get("/health", healthHandler)
// 	r.Get("/ws", wsHandler)

// 	// post route to test manual orders
// 	r.Post("/order", handleOrder)

// 	address := ":" + strconv.Itoa(cfg.Server.Port)

// 	server := &http.Server{
// 		Addr:         address,
// 		Handler:      r,
// 		ReadTimeout:  5 * time.Second,
// 		WriteTimeout: 10 * time.Second,
// 		IdleTimeout:  60 * time.Second,
// 	}

// 	done := make(chan os.Signal, 1)
// 	signal.Notify(done, os.Interrupt, syscall.SIGINT, syscall.SIGTERM)

// 	go func() {
// 		slog.Info("Server running on http://localhost" + address)
// 		log.Fatal(server.ListenAndServe())
// 	}()

// 	<-done
// 	slog.Info("Shutting down server...")

// 	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
// 	defer cancel()

// 	err = server.Shutdown(ctx)

// 	if err != nil {
// 		slog.Error("Server shutdown error:", slog.String("error", err.Error()))
// 	}

// 	slog.Info("Server stopped gracefully")
// }


package main

import (
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/GC-OpenSoft-2026/Algorithmic-Trading-Simulator/internal/matching"
	"github.com/GC-OpenSoft-2026/Algorithmic-Trading-Simulator/internal/models"
	"github.com/GC-OpenSoft-2026/Algorithmic-Trading-Simulator/internal/simulation/gbm"
	"github.com/GC-OpenSoft-2026/Algorithmic-Trading-Simulator/internal/simulation/noise"
	"github.com/GC-OpenSoft-2026/Algorithmic-Trading-Simulator/internal/simulation/synthetic"
)

func main() {
	log.Println("=====================================================")
	log.Println("🚀 STARTING ALGORITHMIC TRADING SIMULATOR")
	log.Println("=====================================================")

	// 1. Initialize Channels
	orderStream := make(chan models.Order, 10000)
	tradeStream := make(chan models.TradeMessage, 10000)
	tickerTape := make(chan float64, 1000) // NEW: Broadcasts executed prices

	// 2. Start the Matching Engine
	engine := matching.NewEngine(orderStream, tradeStream)
	go engine.Start()

	// 3. Start the Trade Consumer (The Ticker Tape Broadcaster)
	go func() {
		for trade := range tradeStream {
			log.Printf("✅ [TRADE EXECUTED] %d shares of %s @ ₹%.2f", trade.Quantity, trade.Symbol, trade.Price)
			
			// Broadcast the live price to the noise trader non-blockingly
			select {
			case tickerTape <- trade.Price:
			default:
				// If tape is full, drop it so we don't block the engine
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
	// NEW: Now receives the live tickerTape channel
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

	// 8. Handle Graceful Shutdown
	done := make(chan os.Signal, 1)
	signal.Notify(done, os.Interrupt, syscall.SIGINT, syscall.SIGTERM)

	<-done

	log.Println("\n--- INITIATING SHUTDOWN ---")
	marketManager.RemoveAsset(symbol)
	time.Sleep(200 * time.Millisecond) 
	log.Println("Exchange offline. Goodbye!")
}