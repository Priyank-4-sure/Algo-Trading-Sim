package handlers

import (
	"net/http"
	"time"

	"github.com/GC-OpenSoft-2026/Algorithmic-Trading-Simulator/internal/api/middleware"
	"github.com/GC-OpenSoft-2026/Algorithmic-Trading-Simulator/internal/models"
	"github.com/GC-OpenSoft-2026/Algorithmic-Trading-Simulator/internal/utils/response"
	"github.com/go-chi/chi/v5"
)

func (h *Handler) PlaceOrder(w http.ResponseWriter, r *http.Request) {
	// Validate the order (e.g., check if the user has enough balance, if the stock symbol is valid, etc.)
}

func (h *Handler) CancelOrder(w http.ResponseWriter, r *http.Request) {
	// Validate the cancellation (e.g., check if the order exists, if it's still open, etc.)
	userID, ok := r.Context().Value(middleware.UserIDKey).(uint)
	if !ok {
		response.WriteJson(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	orderID := chi.URLParam(r, "id")
	if orderID == "" {
		response.WriteJson(w, http.StatusBadRequest, map[string]string{"error": "missing order id"})
		return
	}

	cancel := models.Order{
		ID:        orderID,
		UserID:    userID,
		Type:      models.Cancel,
		Timestamp: time.Now().UnixNano(),
	}

	select {
	case h.OrderStream <- cancel:
		response.WriteJson(w, http.StatusAccepted, response.GeneralSuccess("cancel request queued", map[string]string{"order_id": orderID}))
	default:
		response.WriteJson(w, http.StatusServiceUnavailable, response.GeneralError("engine busy", nil))
	}
}

func (h *Handler) GetOrderStatus(w http.ResponseWriter, r *http.Request) {
	// Retrieve the order status (e.g., check if it's filled, partially filled, or still open)

}

func (h *Handler) GetActiveOrders(w http.ResponseWriter, r *http.Request) {
	// Retrieve all active orders for the user
}

func (h *Handler) GetTradeHistory(w http.ResponseWriter, r *http.Request) {
	// Retrieve the trade history for the user
}

func (h *Handler) GetOrderHistory(w http.ResponseWriter, r *http.Request) {
	// Retrieve the order history for the user
}
