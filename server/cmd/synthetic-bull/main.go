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
	"github.com/GC-OpenSoft-2026/Algorithmic-Trading-Simulator/internal/auth"
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

// Global channels
var orderStream = make(chan models.Order, 1000)
var tradeStream = make(chan models.TradeMessage, 1000)

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
	if req.ID == "" || !req.Quantity.GreaterThan(models.Zero) {
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

// wsHandler removed (now handled in internal/handlers/ws.go)

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

	// 2. Initialize Firebase Admin SDK for token verification
	if err := auth.InitFirebase(); err != nil {
		log.Printf("⚠️  WARNING: Firebase Admin SDK failed to initialize: %v", err)
		log.Println("   → Firebase login will be disabled. Ensure firebase-adminsdk.json exists in the server root.")
		// Non-fatal — app works without Firebase if users use /auth/login instead
	}

	// Initialize LOB broadcast channel (engine → handlers → WS clients)
	lobBroadcast := make(chan interface{}, 1000)

	apphandlers := handlers.New(dbConnections, orderStream, tradeStream, lobBroadcast)

	r := api.SetupRouter(apphandlers)

	log.Println("Initializing the Backend and Simulations...")

	// Initialize and Start the Matching Engine in the background
	engine := matching.NewEngine(orderStream, tradeStream, lobBroadcast)
	go engine.Start()

	// Initialize Simulator Components
	symbol := "BTC/USD"
	tickerTape := make(chan float64, 1000)

	marketManager := gbm.NewMarketManager()
	marketManager.AddAsset(symbol, "crypto", 64230.50)

	marketMaker := synthetic.NewMarketMaker(marketManager, orderStream)
	go marketMaker.Start([]string{symbol}, 500*time.Millisecond)

	noiseTrader := noise.NewAgent(marketManager, orderStream, tickerTape)
	go noiseTrader.Start([]string{symbol}, 24*time.Hour)

	//Start a simple background worker to log trades as they happen
	// (Later, this will be your WebSocket Broadcaster and Aggregator)
	go func() {
		for trade := range tradeStream {
			/*log.Printf("[TRADE STREAM] [%s] Match ID: %s & %s | Qty: %d | Price: ₹%.2f",
			trade.Symbol, trade.MakerOrderID, trade.TakerOrderID, trade.Quantity, trade.Price)*/
			
			select {
			case tickerTape <- trade.Price:
			default:
			}
		}
	}()

	// 8. Register HTTP/WS Routes
	r.Get("/ping", pingHandler)
	r.Get("/health", healthHandler)

	// post route to test manual orders
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

func bootstrapSystemMM(db *database.Connections) {
	username := "SYSTEM_MM"
	var user models.User
	if err := db.Primary.Where("username = ?", username).First(&user).Error; err != nil {
		log.Printf("[BOOTSTRAP] Creating %s user...", username)
		user = models.User{
			Username:    username,
			FirebaseUID: "system_mm_uid",
		}
		db.Primary.Create(&user)

		// Give them massive balances for market making
		db.Primary.Create(&models.Portfolio{UserID: user.ID, Asset: "USD", Balance: 1000000000})
		db.Primary.Create(&models.Portfolio{UserID: user.ID, Asset: "BTC", Balance: 1000000})
		db.Primary.Create(&models.Portfolio{UserID: user.ID, Asset: "ETH", Balance: 10000000})
	}
}
