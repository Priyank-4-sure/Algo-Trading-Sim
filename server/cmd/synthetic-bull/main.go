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
	"github.com/GC-OpenSoft-2026/Algorithmic-Trading-Simulator/internal/storage"
	"github.com/GC-OpenSoft-2026/Algorithmic-Trading-Simulator/internal/utils/response"
	"github.com/coder/websocket"
)

// Global channels
var orderStream = make(chan models.Order, 1000)
var tradeStream = make(chan models.TradeMessage, 1000)

// NEW: snapshots from engine → Redis/Timescale
var lobStream = make(chan models.LOBSnapshot, 500)

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

// handleOrder receives JSON and pushes it into the Engine + DB
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

	// Store order in TimescaleDB (no auth yet, so user is anonymous)
	if store != nil {
		store.InsertOrder(req)
	}

	// Push into engine queue
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
// WebSocket Handler (still echo stub)
// --------------------

func wsHandler(w http.ResponseWriter, r *http.Request) {
	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{
		InsecureSkipVerify: true, // DEV ONLY
	})
	if err != nil {
		log.Println("WS accept error:", err)
		return
	}
	defer conn.Close(websocket.StatusInternalError, "internal error")

	ctx := context.Background()
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
	// 1) Load config
	cfg, err := config.LoadConfig()
	if err != nil {
		log.Fatal("Failed to load configuration:", err)
	}

	// 2) Init databases (Postgres, TimescaleDB, Redis)
	dbConnections, err := database.Init(cfg)
	if err != nil {
		log.Fatal("Failed to initialize databases:", err)
	}

	// 3) Init financial storage (TimescaleDB + Redis) and run schema
	if dbConnections.Candlestick == nil || dbConnections.Redis == nil {
		log.Fatal("Candlestick DB or Redis connection is nil")
	}
	if err := storage.InitSchema(dbConnections.Candlestick); err != nil {
		log.Fatal("Failed to run storage schema migration:", err)
	}
	store = storage.NewStore(dbConnections.Candlestick, dbConnections.Redis)

	// 4) HTTP handlers scaffold (future use for DB-backed routes)
	apphandlers := handlers.New(dbConnections)
	r := api.SetupRouter(apphandlers)

	log.Println("Initializing the Backend...")

	// 5) Matching engine: now takes lobStream too
	engine := matching.NewEngine(orderStream, tradeStream, lobStream)
	go engine.Start()

	// 6) Start storage pipeline: consume trades + LOB snapshots
	store.StartPipeline(tradeStream, lobStream)

	// 7) Routes
	r.Get("/ping", pingHandler)
	r.Get("/health", healthHandler)
	r.Get("/ws", wsHandler)
	r.Post("/order", handleOrder)

	// 8) HTTP server setup
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
		log.Fatal(server.ListenAndServe())
	}()

	<-done
	slog.Info("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		slog.Error("Server shutdown error:", slog.String("error", err.Error()))
	}
	slog.Info("Server stopped gracefully")
}
