package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"log/slog"
	"net/http"
	"strings"

	"github.com/GC-OpenSoft-2026/Algorithmic-Trading-Simulator/internal/config"
	"github.com/GC-OpenSoft-2026/Algorithmic-Trading-Simulator/internal/models"
	"github.com/GC-OpenSoft-2026/Algorithmic-Trading-Simulator/internal/utils"
	"github.com/GC-OpenSoft-2026/Algorithmic-Trading-Simulator/internal/utils/response"
	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"
)

type priceUpdate struct {
	Symbol string
	Price  any
}

func (h *Handler) HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	// 1. Try to Authenticate
	var userID uint
	tokenString := r.URL.Query().Get("token")
	if tokenString == "" {
		// Try header
		authHeader := r.Header.Get("Authorization")
		if strings.HasPrefix(authHeader, "Bearer ") {
			tokenString = authHeader[7:]
		}
	}

	if tokenString != "" {
		cfg, _ := config.LoadConfig()
		claims, err := utils.ValidateToken(tokenString, cfg.Server.JWTSecret)
		if err == nil {
			userID = claims.UserID
			slog.Info("Authenticated WS connection", "userID", userID)
		} else {
			slog.Warn("Wont authenticate WS connection: invalid token", "error", err)
		}
	}

	c, err := websocket.Accept(w, r, &websocket.AcceptOptions{
		InsecureSkipVerify: true,
	})

	if err != nil {
		response.WriteJson(w, http.StatusInternalServerError, map[string]string{"error": "Failed to accept WebSocket connection"})
		return
	}

	defer c.CloseNow()

	ctx := r.Context()
	slog.Info("🟢 Frontend connected to WebSocket")

	for {
		var msg models.ClientMessage

		// wsjson.Read pauses here and waits for the frontend to send a message
		err := wsjson.Read(ctx, c, &msg)
		if err != nil {
			// If we get an error here, it usually means the client disconnected
			slog.Error("🔴 WebSocket closed or read error", "error", err)
			break
		}

		// 3. Handle the Subscription Request
		if msg.Action == "subscribe" {
			slog.Info("Client wants to subscribe to topic", "topic", msg.Topic)

			// Route the request based on the topic prefix
			// (In a real app, this triggers a Redis Pub/Sub subscription)
			switch {
			case len(msg.Topic) > 9 && msg.Topic[:9] == "orderbook":
				go h.streamLobSnapshot(ctx, c, msg.Topic) // Run in a background thread
			case len(msg.Topic) > 7 && msg.Topic[:7] == "candles":
				go h.streamCandles(ctx, c, msg.Topic)
			case len(msg.Topic) > 9 && msg.Topic[:9] == "portfolio":
				if userID == 0 {
					slog.Warn("Unauthenticated client tried to subscribe to portfolio data")
					continue
				}
				go h.streamPortFolioData(ctx, c, msg.Topic, userID)
			default:
				slog.Error("Unknown topic requested", "topic", msg.Topic)
			}
		}
	}

}

func (h *Handler) streamOrderbook(ctx context.Context, c *websocket.Conn, topic string) {
	// USE REDIS!
	pubsub := h.DB.Redis.Subscribe(ctx, topic)
	defer pubsub.Close()
	ch := pubsub.Channel()

	log.Printf("📡 Subscribed to Redis channel: %s", topic)

	for {
		select {
		case <-ctx.Done():
			log.Printf("🛑 Client disconnected from %s", topic)
			return

		case msg := <-ch:
			// A message arrived from Redis
			var obUpdate models.OrderbookUpdate
			if err := json.Unmarshal([]byte(msg.Payload), &obUpdate); err != nil {
				continue
			}

			response := models.ServerMessage{
				Topic: topic,
				Data:  obUpdate,
			}

			if err := wsjson.Write(ctx, c, response); err != nil {
				return
			}
		}
	}
}

func (h *Handler) streamLobSnapshot(ctx context.Context, c *websocket.Conn, topic string) {
	// This Streams LOB Snapshots from redis
	pubsub := h.DB.Redis.Subscribe(ctx, topic)
	defer pubsub.Close()
	ch := pubsub.Channel()
	log.Printf("📡 Subscribed to Redis channel: %s", topic)

	for {
		select {
		case <-ctx.Done():
			log.Printf("🛑 Client disconnected from %s", topic)
			return
		case msg := <-ch:
			var lobSnapshot models.LOBSnapshot
			if err := json.Unmarshal([]byte(msg.Payload), &lobSnapshot); err != nil {
				continue
			}

			if err := wsjson.Write(ctx, c, models.ServerMessage{
				Topic: topic,
				Data:  lobSnapshot,
			}); err != nil {
				return
			}
		}

	}
}

func (h *Handler) streamCandles(ctx context.Context, c *websocket.Conn, topic string) {
	pubsub := h.DB.Redis.Subscribe(ctx, topic)
	defer pubsub.Close()
	ch := pubsub.Channel()

	log.Printf("📡 Subscribed to Redis channel: %s", topic)

	// 1. Extract the actual symbol from the topic (e.g., "candles:TECH" -> "TECH")
	symbol := topic
	parts := strings.Split(topic, ":")
	if len(parts) == 2 {
		symbol = parts[1]
	}

	// 2. Fetch using the extracted symbol
	candles, err := h.Store.GetCandles(symbol, "1s", 100)
	if err != nil {
		log.Printf("Error fetching candles for %s: %v", symbol, err)
	}

	if len(candles) > 0 {
		// 3. Send historical data with a distinct topic or flag so the frontend
		// knows it's receiving an Array of candles, not a single Object.
		if err := wsjson.Write(ctx, c, models.ServerMessage{
			Topic: topic + ":historical", // Distinct topic for the initial load
			Data:  candles,
		}); err != nil {
			return
		}
	} else {
		log.Printf("No historical candles found for %s", symbol)
	}

	// ... (Your real-time select loop remains exactly the same)
	for {
		select {
		case <-ctx.Done():
			log.Printf("🛑 Client disconnected from %s", topic)
			return
		case msg := <-ch:
			var candleData json.RawMessage = []byte(msg.Payload)
			response := models.ServerMessage{
				Topic: topic,
				Data:  candleData,
			}
			if err := wsjson.Write(ctx, c, response); err != nil {
				return
			}
		}
	}
}

func (h *Handler) streamPortFolioData(ctx context.Context, c *websocket.Conn, topic string, userID uint) {
	// 1. Get User Portfolio from Postgres
	portfolio, err := h.GetPortfolio(fmt.Sprintf("%d", userID))
	if err != nil {
		slog.Error("Failed to get portfolio for user", "userID", userID, "error", err)
		return
	}

	for _, holding := range portfolio.Holdings {
		price, err := h.Store.GetCurrentPrice(holding.Symbol)
		if err != nil {
			slog.Error("Failed to get initial price", "symbol", holding.Symbol, "error", err)
			continue
		}
		holding.CurrentPrice = price
	}

	// 3. Send initial payload
	initialResponse := models.ServerMessage{
		Topic: topic,
		Data: map[string]any{
			"portfolio": portfolio,
		},
	}
	if err := wsjson.Write(ctx, c, initialResponse); err != nil {
		slog.Error("Failed to write initial portfolio data", "userID", userID, "error", err)
		return
	}

	// 4. Create a central channel for state updates
	updateCh := make(chan priceUpdate)

	// 5. Start a SINGLE state-manager goroutine
	// This ensures only one thread updates the map and writes to the websocket
	go func() {
		for {
			select {
			case <-ctx.Done():
				return // exit if websocket disconnects
			case update := <-updateCh:
				// Safely update the map (no mutex needed since it's only happening in this goroutine)
				for i := range portfolio.Holdings {
					if portfolio.Holdings[i].Symbol == update.Symbol {
						portfolio.Holdings[i].CurrentPrice = update.Price.(float64)
						break
					}
				}
				response := models.ServerMessage{
					Topic: topic,
					Data: map[string]any{
						"portfolio": portfolio,
					},
				}

				// Safely write to websocket sequentially
				if err := wsjson.Write(ctx, c, response); err != nil {
					log.Printf("Failed to write websocket update for user %d: %v", userID, err)
					return // consider closing the connection/context here
				}
			}
		}
	}()

	// 6. Start Redis subscribers for each holding
	for _, holding := range portfolio.Holdings {
		// Pass holding.Symbol explicitly to the closure to avoid variable capture bugs
		go func(symbol string) {
			candleTopic := "candles:" + symbol
			pubsub := h.DB.Redis.Subscribe(ctx, candleTopic)
			defer pubsub.Close()
			ch := pubsub.Channel()

			log.Printf("📡 Subscribed to Redis channel: %s for user %d", candleTopic, userID)

			for {
				select {
				case <-ctx.Done():
					log.Printf("🛑 Client disconnected from %s", candleTopic)
					return
				case msg := <-ch:
					// PRO TIP: Try to unmarshal the price directly from msg.Payload
					// instead of hitting the database!
					// Example:
					// var newPrice float64
					// if err := json.Unmarshal([]byte(msg.Payload), &newPrice); err == nil {
					//     updateCh <- priceUpdate{Symbol: symbol, Price: newPrice}
					// }

					log.Printf("Received update for %s: %s", symbol, msg.Payload)

					// If you MUST hit the DB:
					price, err := h.Store.GetCurrentPrice(symbol)
					if err != nil {
						slog.Error("Failed to get current price", "symbol", symbol, "error", err)
						continue
					}

					// Send the update to the manager goroutine
					updateCh <- priceUpdate{
						Symbol: symbol,
						Price:  price,
					}
				}
			}
		}(holding.Symbol)
	}
}
