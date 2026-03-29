package handlers

import (
	"context"
	"encoding/json"
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
	// 1. Subscribe to the Redis channel
	pubsub := h.DB.Redis.Subscribe(ctx, topic)
	defer pubsub.Close()
	ch := pubsub.Channel()

	log.Printf("📡 Subscribed to Redis channel: %s", topic)

	for {
		select {
		case <-ctx.Done():
			// Context is canceled when the client disconnects or request ends
			log.Printf("🛑 Client disconnected from %s", topic)
			return

		case msg := <-ch:
			// 2. Use json.RawMessage to pass the JSON through efficiently
			// without needing to decode/encode fields we aren't modifying.
			var candleData json.RawMessage = []byte(msg.Payload)

			// 3. Wrap in your standard ServerMessage
			response := models.ServerMessage{
				Topic: topic,
				Data:  candleData,
			}

			// 4. Send to the frontend
			if err := wsjson.Write(ctx, c, response); err != nil {
				// If this fails, the client likely dropped the connection
				return
			}
		}
	}
}
