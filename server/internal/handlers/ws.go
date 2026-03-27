package handlers

import (
	"context"
	"encoding/json"
	"log"
	"log/slog"
	"net/http"

	"github.com/GC-OpenSoft-2026/Algorithmic-Trading-Simulator/internal/models"
	"github.com/GC-OpenSoft-2026/Algorithmic-Trading-Simulator/internal/utils/response"
	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"
)

func (h *Handler) HandleWebSocket(w http.ResponseWriter, r *http.Request) {
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
				go h.streamOrderbook(ctx, c, msg.Topic) // Run in a background thread
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

func (h *Handler) streamCandles(ctx context.Context, c *websocket.Conn, topic string) {}

// lobBroadcastWorker receives LOBSnapshot messages from the matching engine and
// fans them out to ALL connected WebSocket clients as "lob_update" action messages.
// This is the direct real-data pipeline: MatchingEngine → LOBBroadcast channel → WS clients.
func (h *Handler) lobBroadcastWorker() {
	log.Println("📡 LOB Broadcast Worker started — streaming real-time order book to clients")
	for msg := range h.LOBBroadcast {
		h.Broadcast("lob_update", msg)
	}
}

