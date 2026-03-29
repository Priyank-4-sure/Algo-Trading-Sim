package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/GC-OpenSoft-2026/Algorithmic-Trading-Simulator/internal/api/middleware"
	"github.com/GC-OpenSoft-2026/Algorithmic-Trading-Simulator/internal/models"
	"github.com/GC-OpenSoft-2026/Algorithmic-Trading-Simulator/internal/utils/response"
	"github.com/go-chi/chi/v5"
	"gorm.io/gorm"
)

func (h *Handler) PlaceOrder(w http.ResponseWriter, r *http.Request) {
	// Validate the order (e.g., check if the user has enough balance, if the stock symbol is valid, etc.)
	userID, ok := r.Context().Value(middleware.UserIDKey).(uint)
	if !ok {
		response.WriteJson(w, http.StatusUnauthorized, response.GeneralError("unauthorized", nil))
		return
	}

	var req struct {
		ID       string  `json:"id"`
		Symbol   string  `json:"symbol"`
		Type     string  `json:"type"`
		Side     string  `json:"side"`
		Price    float64 `json:"price"`
		Quantity int64   `json:"quantity"`
	}

	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&req); err != nil {
		response.WriteJson(w, http.StatusBadRequest, response.GeneralError("invalid request body", err))
		return
	}

	if req.Symbol == "" {
		response.WriteJson(w, http.StatusBadRequest, response.GeneralError("symbol is required", nil))
		return
	}
	if req.Quantity <= 0 {
		response.WriteJson(w, http.StatusBadRequest, response.GeneralError("quantity must be greater than 0", nil))
		return
	}
	if req.Type != string(models.Limit) && req.Type != string(models.Market) {
		response.WriteJson(w, http.StatusBadRequest, response.GeneralError("type must be LIMIT or MARKET", nil))
		return
	}
	if req.Side != string(models.Buy) && req.Side != string(models.Sell) {
		response.WriteJson(w, http.StatusBadRequest, response.GeneralError("side must be BUY or SELL", nil))
		return
	}

	if req.Side == string(models.Buy) {
		if req.Price <= 0 {
			response.WriteJson(w, http.StatusBadRequest, response.GeneralError("price must be greater than 0 for BUY orders", nil))
			return
		}

		var portfolio models.Portfolio
		if err := h.DB.Primary.Where("user_id = ?", userID).First(&portfolio).Error; err != nil {
			response.WriteJson(w, http.StatusInternalServerError, response.GeneralError("failed to fetch portfolio", err))
			return
		}

		requiredCash := float64(req.Quantity) * req.Price
		if portfolio.Balance < requiredCash {
			response.WriteJson(w, http.StatusBadRequest, response.GeneralError("insufficient balance", nil))
			return
		}
	}

	if req.Side == string(models.Sell) {
		var portfolio models.Portfolio
		if err := h.DB.Primary.Where("user_id = ?", userID).First(&portfolio).Error; err != nil {
			response.WriteJson(w, http.StatusInternalServerError, response.GeneralError("failed to fetch portfolio", err))
			return
		}

		var holding models.Holding
		err := h.DB.Primary.Where("portfolio_id = ? AND symbol = ?", portfolio.ID, req.Symbol).First(&holding).Error
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				response.WriteJson(w, http.StatusBadRequest, response.GeneralError("insufficient holdings", nil))
				return
			}
			response.WriteJson(w, http.StatusInternalServerError, response.GeneralError("failed to fetch holdings", err))
			return
		}

		if int64(holding.Quantity) < req.Quantity {
			response.WriteJson(w, http.StatusBadRequest, response.GeneralError("insufficient holdings", nil))
			return
		}
	}

	orderID := strings.TrimSpace(req.ID)
	if orderID == "" {
		orderID = fmt.Sprintf("ORD-%d", time.Now().UnixNano())
	}

	order := models.Order{
		ID:        orderID,
		UserID:    userID,
		Symbol:    req.Symbol,
		Type:      models.OrderType(req.Type),
		Side:      models.Side(req.Side),
		Price:     req.Price,
		Quantity:  req.Quantity,
		Status:    models.StatusPending,
		Timestamp: time.Now().UnixNano(),
	}

	select {
	case h.OrderStream <- order:
		response.WriteJson(w, http.StatusAccepted, response.GeneralSuccess("order queued", map[string]string{"order_id": order.ID}))
	default:
		response.WriteJson(w, http.StatusServiceUnavailable, response.GeneralError("engine busy", nil))
	}
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
