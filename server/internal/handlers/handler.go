package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"gorm.io/gorm"

	"github.com/GC-OpenSoft-2026/Algorithmic-Trading-Simulator/internal/auth"
	"github.com/GC-OpenSoft-2026/Algorithmic-Trading-Simulator/internal/database"
	"github.com/GC-OpenSoft-2026/Algorithmic-Trading-Simulator/internal/models"
	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"
)

// Handler is the core struct that holds your database connections.
// Every specific handler function will be attached to this struct.
type Handler struct {
	DB           *database.Connections
	OrderStream  chan<- models.Order
	TradeStream  <-chan models.TradeMessage
	LOBBroadcast <-chan interface{} // Receives LOBSnapshot messages from the matching engine

	// Thread-safe WebSocket client tracking
	Clients   map[*websocket.Conn]string
	clientsMu sync.RWMutex
}

// New creates a new Handler instance with the injected databases and channels
func New(db *database.Connections, orderStream chan<- models.Order, tradeStream <-chan models.TradeMessage, lobBroadcast <-chan interface{}) *Handler {
	h := &Handler{
		DB:           db,
		OrderStream:  orderStream,
		TradeStream:  tradeStream,
		LOBBroadcast: lobBroadcast,
		Clients:      make(map[*websocket.Conn]string),
	}
	// Start the background ledger worker to persist trades to PostgreSQL
	go h.ledgerWorker()
	// Start the LOB broadcast worker to push live order book updates to WS clients
	go h.lobBroadcastWorker()
	return h
}

// --------------------
// Auth Handlers
// --------------------

// LoginHandler accepts a simple username JSON and returns a JWT token
func (h *Handler) LoginHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Username string `json:"username"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Username == "" {
		http.Error(w, `{"error":"invalid request, username required"}`, http.StatusBadRequest)
		return
	}

	accessToken, err := auth.GenerateAccessToken(req.Username)
	if err != nil {
		http.Error(w, `{"error":"failed to generate token"}`, http.StatusInternalServerError)
		return
	}
	refreshToken, _ := auth.GenerateRefreshToken(req.Username)
	setRefreshCookie(w, refreshToken)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"token":    accessToken,
		"username": req.Username,
	})
}

// setRefreshCookie is a helper to apply securely configured cookies.
func setRefreshCookie(w http.ResponseWriter, token string) {
	http.SetCookie(w, &http.Cookie{
		Name:     "refresh_token",
		Value:    token,
		Expires:  time.Now().Add(7 * 24 * time.Hour),
		HttpOnly: true,
		Secure:   false, // WARNING: Must be true in HTTPS production
		SameSite: http.SameSiteLaxMode,
		Path:     "/api/v1/auth",
	})
}

// FirebaseLoginHandler handles exchanging a Firebase ID token for our custom low-latency JWT.
func (h *Handler) FirebaseLoginHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		FirebaseToken string `json:"firebase_token"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request payload"}`, http.StatusBadRequest)
		return
	}

	if req.FirebaseToken == "" {
		http.Error(w, `{"error":"missing firebase token"}`, http.StatusBadRequest)
		return
	}

	// Verify the token with Google/Firebase
	token, err := auth.VerifyFirebaseIDToken(r.Context(), req.FirebaseToken)
	if err != nil {
		log.Printf("[Firebase Auth] token verification failed: %v", err)
		http.Error(w, `{"error":"invalid firebase token"}`, http.StatusUnauthorized)
		return
	}

	// Token is valid. Get user details from claims.
	username := token.UID
	if emailClaim, ok := token.Claims["email"]; ok {
		if emailStr, ok := emailClaim.(string); ok && emailStr != "" {
			username = emailStr
		}
	}

	// Provide internal Database hooks for Ledger Persistence
	var postgresUser models.User
	result := h.DB.Primary.Where("firebase_uid = ?", token.UID).First(&postgresUser)
	
	if result.Error != nil {
		// New User Registration JIT
		postgresUser = models.User{
			FirebaseUID: token.UID,
			Username:    username,
		}
		if err := h.DB.Primary.Create(&postgresUser).Error; err != nil {
			log.Printf("[Auth] Failed to create postgres user: %v", err)
			http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
			return
		}

		// Fund completely new accounts with $100,000 for Algorithmic Demo
		portfolio := models.Portfolio{
			UserID:  postgresUser.ID,
			Asset:   "USD",
			Balance: 100000.0,
		}
		h.DB.Primary.Create(&portfolio)
	}

	// Issue low-latency dual token architecture
	accessTokenStr, err := auth.GenerateAccessToken(postgresUser.ID)
	if err != nil {
		log.Printf("[Auth] Failed to generate custom JWT: %v", err)
		http.Error(w, `{"error":"failed to generate custom token"}`, http.StatusInternalServerError)
		return
	}

	refreshTokenStr, _ := auth.GenerateRefreshToken(postgresUser.ID)
	setRefreshCookie(w, refreshTokenStr)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"token":    accessTokenStr,
		"username": postgresUser.Username,
	})
}

// RefreshHandler silently handles Access Token renewal using HttpOnly cookies
func (h *Handler) RefreshHandler(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie("refresh_token")
	if err != nil {
		http.Error(w, `{"error":"refresh token missing"}`, http.StatusUnauthorized)
		return
	}

	userID, err := auth.ValidateJWT(cookie.Value)
	if err != nil {
		http.Error(w, `{"error":"invalid refresh token"}`, http.StatusUnauthorized)
		return
	}

	accessToken, err := auth.GenerateAccessToken(userID)
	if err != nil {
		http.Error(w, `{"error":"failed to generate access token"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"token": accessToken,
	})
}

// LogoutHandler explicitly destroys the HttpOnly refresh token cookie to sever persistence
func (h *Handler) LogoutHandler(w http.ResponseWriter, r *http.Request) {
	http.SetCookie(w, &http.Cookie{
		Name:     "refresh_token",
		Value:    "",
		Expires:  time.Unix(0, 0),
		MaxAge:   -1, // Delete immediately
		HttpOnly: true,
		Secure:   false,
		SameSite: http.SameSiteLaxMode,
		Path:     "/api/v1/auth",
	})
	w.WriteHeader(http.StatusOK)
}

// --------------------
// WebSocket Handler
// --------------------

// WSHandler upgrades the HTTP connection to a WebSocket and routes incoming messages.
func (h *Handler) WSHandler(w http.ResponseWriter, r *http.Request) {
	// Extract and validate JWT from query parameter
	tokenStr := r.URL.Query().Get("token")
	if tokenStr == "" {
		http.Error(w, "missing token", http.StatusUnauthorized)
		return
	}

	username, err := auth.ValidateJWT(tokenStr)
	if err != nil {
		log.Printf("WS auth failed: %v", err)
		http.Error(w, "invalid token", http.StatusUnauthorized)
		return
	}

	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{
		// Allow all origins (DEV ONLY — restrict in prod)
		InsecureSkipVerify: true,
	})
	if err != nil {
		log.Println("WS accept error:", err)
		return
	}

	// Register the client
	h.clientsMu.Lock()
	h.Clients[conn] = username
	h.clientsMu.Unlock()

	log.Printf("Client connected: %s (total: %d)", username, len(h.Clients))

	// Ensure cleanup on disconnect
	defer func() {
		h.clientsMu.Lock()
		delete(h.Clients, conn)
		h.clientsMu.Unlock()
		conn.Close(websocket.StatusNormalClosure, "bye")
		log.Printf("Client disconnected: %s (total: %d)", username, len(h.Clients))
	}()

	ctx := context.Background()

	for {
		var msg models.WSMessage
		if err := wsjson.Read(ctx, conn, &msg); err != nil {
			log.Printf("WS read error (%s): %v", username, err)
			break
		}

		log.Printf("WS Action: %s (from: %s)\n", msg.Action, username)

		switch msg.Action {
		case "place_order":
			var order models.Order
			if err := json.Unmarshal(msg.Payload, &order); err != nil {
				wsjson.Write(ctx, conn, map[string]string{
					"action": "error",
					"error":  "Invalid order payload",
				})
				continue
			}

			// Attach the authenticated username to the order
			order.Username = username

			// --- JIT Balance Verification ---
			var portfolio models.Portfolio
			assetToCheck := "USD"
			if order.Side == models.SideSell {
				// To sell BTC, you need BTC balance
				assetToCheck = strings.Split(order.Symbol, "/")[0]
			}

			if err := h.DB.Primary.Where("username = ? AND asset = ?", username, assetToCheck).
				Joins("JOIN users ON users.id = portfolios.user_id").
				First(&portfolio).Error; err != nil {
				wsjson.Write(ctx, conn, map[string]string{
					"action": "error",
					"error":  "Portfolio not found. Please relogin.",
				})
				continue
			}

			if order.Side == models.SideBuy {
				orderValue := order.Price.ToFloat64() * order.Quantity.ToFloat64()
				if portfolio.Balance < orderValue {
					wsjson.Write(ctx, conn, map[string]string{
						"action": "error",
						"error":  fmt.Sprintf("Insufficient USD. Required: $%.2f, Available: $%.2f", orderValue, portfolio.Balance),
					})
					continue
				}
			} else {
				if portfolio.Balance < order.Quantity.ToFloat64() {
					wsjson.Write(ctx, conn, map[string]string{
						"action": "error",
						"error":  fmt.Sprintf("Insufficient %s. Required: %.4f, Available: %.4f", assetToCheck, order.Quantity.ToFloat64(), portfolio.Balance),
					})
					continue
				}
			}

			// Push order into the engine
			h.OrderStream <- order

			// Acknowledge the order
			wsjson.Write(ctx, conn, map[string]interface{}{
				"action":   "order_ack",
				"order_id": order.ID,
				"symbol":   order.Symbol,
				"status":   "QUEUED",
			})

		case "fetch_portfolio":
			h.broadcastPortfolio(username)

		default:
			wsjson.Write(ctx, conn, map[string]string{
				"action": "error",
				"error":  "Unknown action: " + msg.Action,
			})
		}
	}
}

// --------------------
// Ledger Persistence
// --------------------

// ledgerWorker handles the ACID-compliant settlement of trades in PostgreSQL.
// It deducts from the Taker and credits the Maker (and vice-versa) based on trade outcomes.
func (h *Handler) ledgerWorker() {
	log.Println("⚡ Ledger Worker Started: Persistent Settlement Active")
	for trade := range h.TradeStream {
		// Run update in a single transaction to ensure consistency
		err := h.DB.Primary.Transaction(func(tx *gorm.DB) error {
			// Skip settlement for synthetic trades (noise traders/market makers)
			if trade.TakerUsername == "" || trade.MakerUsername == "" {
				return nil
			}

			// 1. Determine assets
			symbolParts := strings.Split(trade.Symbol, "/")
			if len(symbolParts) < 2 {
				return nil
			}
			baseAsset := symbolParts[0] // e.g. "BTC"
			quoteAsset := symbolParts[1] // e.g. "USD"

			totalQuote := trade.Price * float64(trade.Quantity)
			baseQty := float64(trade.Quantity)

			// 2. Determine direction
			// If Taker is BUYER: Taker gives USD, gets BTC. Maker gives BTC, gets USD.
			// If Taker is SELLER: Taker gives BTC, gets USD. Maker gives USD, gets BTC.
			
			var takerDeductAsset, takerAddAsset string
			var takerDeductAmt, takerAddAmt float64
			var makerDeductAsset, makerAddAsset string
			var makerDeductAmt, makerAddAmt float64

			if trade.TakerSide == models.SideBuy {
				takerDeductAsset, takerDeductAmt = quoteAsset, totalQuote
				takerAddAsset, takerAddAmt = baseAsset, baseQty
				makerDeductAsset, makerDeductAmt = baseAsset, baseQty
				makerAddAsset, makerAddAmt = quoteAsset, totalQuote
			} else {
				takerDeductAsset, takerDeductAmt = baseAsset, baseQty
				takerAddAsset, takerAddAmt = quoteAsset, totalQuote
				makerDeductAsset, makerDeductAmt = quoteAsset, totalQuote
				makerAddAsset, makerAddAmt = baseAsset, baseQty
			}

			// 3. Execution (Atomic updates)
			// Deduct from Taker
			if err := tx.Exec("UPDATE portfolios SET balance = balance - ?, updated_at = NOW() WHERE asset = ? AND user_id = (SELECT id FROM users WHERE username = ?)", 
				takerDeductAmt, takerDeductAsset, trade.TakerUsername).Error; err != nil {
				return err
			}
			// Add to Taker
			if err := tx.Exec("UPDATE portfolios SET balance = balance + ?, updated_at = NOW() WHERE asset = ? AND user_id = (SELECT id FROM users WHERE username = ?)", 
				takerAddAmt, takerAddAsset, trade.TakerUsername).Error; err != nil {
				return err
			}
			// Deduct from Maker
			if err := tx.Exec("UPDATE portfolios SET balance = balance - ?, updated_at = NOW() WHERE asset = ? AND user_id = (SELECT id FROM users WHERE username = ?)", 
				makerDeductAmt, makerDeductAsset, trade.MakerUsername).Error; err != nil {
				return err
			}
			// Add to Maker
			if err := tx.Exec("UPDATE portfolios SET balance = balance + ?, updated_at = NOW() WHERE asset = ? AND user_id = (SELECT id FROM users WHERE username = ?)", 
				makerAddAmt, makerAddAsset, trade.MakerUsername).Error; err != nil {
				return err
			}

			// 4. Trigger Portfolio Updates for both users
			h.broadcastPortfolio(trade.TakerUsername)
			h.broadcastPortfolio(trade.MakerUsername)

			return nil
		})

		if err != nil {
			log.Printf("❌ Ledger error: %v", err)
		}
	}
}

// broadcastPortfolio fetches a user's balances and pushes to their WS connection
func (h *Handler) broadcastPortfolio(username string) {
	var portfolios []models.Portfolio
	if err := h.DB.Primary.Where("user_id = (SELECT id FROM users WHERE username = ?)", username).Find(&portfolios).Error; err != nil {
		log.Printf("Failed to fetch portfolio for %s: %v", username, err)
		return
	}

	h.clientsMu.RLock()
	var userConn *websocket.Conn
	for conn, u := range h.Clients {
		if u == username {
			userConn = conn
			break
		}
	}
	h.clientsMu.RUnlock()

	if userConn != nil {
		wsjson.Write(context.Background(), userConn, map[string]interface{}{
			"action":  "portfolio_update",
			"payload": portfolios,
		})
	}
}

// Broadcast sends a message to all connected WebSocket clients.
// Failed sends remove the client gracefully — no panics.
func (h *Handler) Broadcast(action string, payload interface{}) {
	msg := map[string]interface{}{
		"action":  action,
		"payload": payload,
	}

	h.clientsMu.RLock()
	clients := make(map[*websocket.Conn]string, len(h.Clients))
	for conn, user := range h.Clients {
		clients[conn] = user
	}
	h.clientsMu.RUnlock()

	for conn, user := range clients {
		if err := wsjson.Write(context.Background(), conn, msg); err != nil {
			log.Printf("Broadcast send failed to %s: %v", user, err)
			// Remove dead client
			h.clientsMu.Lock()
			delete(h.Clients, conn)
			h.clientsMu.Unlock()
			conn.Close(websocket.StatusInternalError, "broadcast error")
		}
	}
}