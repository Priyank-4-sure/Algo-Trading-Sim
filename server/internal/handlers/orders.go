package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/GC-OpenSoft-2026/Algorithmic-Trading-Simulator/internal/api/middleware"
	"github.com/GC-OpenSoft-2026/Algorithmic-Trading-Simulator/internal/models"
	"github.com/GC-OpenSoft-2026/Algorithmic-Trading-Simulator/internal/utils/response"
	"github.com/go-chi/chi/v5"
	"github.com/redis/go-redis/v9"
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
		h.Store.InsertOrder(order)
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
	userID, ok := r.Context().Value(middleware.UserIDKey).(uint)
	if !ok {
		response.WriteJson(w, http.StatusUnauthorized, response.GeneralError("unauthorized", nil))
		return
	}

	orderID := strings.TrimSpace(chi.URLParam(r, "id"))
	if orderID == "" {
		response.WriteJson(w, http.StatusBadRequest, response.GeneralError("missing order id", nil))
		return
	}

	rawOrder, err := h.DB.Redis.Get(r.Context(), "order:"+orderID).Result()
	if errors.Is(err, redis.Nil) {
		response.WriteJson(w, http.StatusNotFound, response.GeneralError("order not found", nil))
		return
	}
	if err != nil {
		response.WriteJson(w, http.StatusInternalServerError, response.GeneralError("failed to fetch order status", err))
		return
	}

	var order models.Order
	if err := json.Unmarshal([]byte(rawOrder), &order); err != nil {
		response.WriteJson(w, http.StatusInternalServerError, response.GeneralError("failed to parse order data", err))
		return
	}
	if order.UserID != userID {
		response.WriteJson(w, http.StatusNotFound, response.GeneralError("order not found", nil))
		return
	}
	response.WriteJson(w, http.StatusOK, response.GeneralSuccess("order status retrieved", map[string]interface{}{
		"id":              order.ID,
		"status":          order.Status,
		"filled_quantity": order.FilledQuantity,
		"quantity":        order.Quantity,
		"symbol":          order.Symbol,
		"side":            order.Side,
		"type":            order.Type,
		"price":           order.Price,
		"timestamp":       order.Timestamp,
	}))
}

func (h *Handler) GetActiveOrders(w http.ResponseWriter, r *http.Request) {
	// Retrieve all active orders for the user
	userID, ok := r.Context().Value(middleware.UserIDKey).(uint)
	if !ok {
		response.WriteJson(w, http.StatusUnauthorized, response.GeneralError("unauthorized", nil))
		return
	}

	ctx := r.Context()
	indexKey := fmt.Sprintf("orders:user:%d", userID)
	orderIDs, err := h.DB.Redis.ZRangeArgs(ctx, redis.ZRangeArgs{
		Key:   indexKey,
		Start: 0,
		Stop:  -1,
		Rev:   true,
	}).Result()
	if err != nil {
		response.WriteJson(w, http.StatusInternalServerError, response.GeneralError("failed to fetch active orders", err))
		return
	}

	activeOrders := make([]models.Order, 0)
	if len(orderIDs) == 0 {
		response.WriteJson(w, http.StatusOK, response.GeneralSuccess("active orders retrieved", map[string]interface{}{
			"orders": activeOrders,
		}))
		return
	}

	keys := make([]string, 0, len(orderIDs))
	for _, id := range orderIDs {
		keys = append(keys, "order:"+id)
	}

	rawOrders, err := h.DB.Redis.MGet(ctx, keys...).Result()
	if err != nil {
		response.WriteJson(w, http.StatusInternalServerError, response.GeneralError("failed to fetch active orders", err))
		return
	}

	for _, raw := range rawOrders {
		if raw == nil {
			continue // Order may have expired from Redis TTL.
		}

		rawStr, ok := raw.(string)
		if !ok {
			continue
		}

		var order models.Order
		if err := json.Unmarshal([]byte(rawStr), &order); err != nil {
			continue
		}

		if order.UserID != userID {
			continue
		}

		if order.Status == models.StatusPending || order.Status == models.StatusPartial {
			activeOrders = append(activeOrders, order)
		}
	}

	response.WriteJson(w, http.StatusOK, response.GeneralSuccess("active orders retrieved", map[string]interface{}{
		"orders": activeOrders,
	}))

}

func (h *Handler) GetTradeHistory(w http.ResponseWriter, r *http.Request) {
	// Retrieve the trade history for the user
	userID, ok := r.Context().Value(middleware.UserIDKey).(uint)
	if !ok {
		response.WriteJson(w, http.StatusUnauthorized, response.GeneralError("unauthorized", nil))
		return
	}

	limit := 50
	if rawLimit := strings.TrimSpace(r.URL.Query().Get("limit")); rawLimit != "" {
		parsed, err := strconv.Atoi(rawLimit)
		if err != nil || parsed <= 0 {
			response.WriteJson(w, http.StatusBadRequest, response.GeneralError("limit must be a positive integer", nil))
			return
		}
		if parsed > 200 {
			parsed = 200
		}
		limit = parsed
	}

	orders, err := h.Store.GetOrdersByUser(userID)
	if err != nil {
		response.WriteJson(w, http.StatusInternalServerError, response.GeneralError("failed to fetch user orders", err))
		return
	}

	if len(orders) == 0 {
		response.WriteJson(w, http.StatusOK, response.GeneralSuccess("trade history retrieved", map[string]interface{}{
			"trades": []models.TradeMessage{},
		}))
		return
	}

	uniqueSymbols := make(map[string]struct{})
	for _, order := range orders {
		if order.Symbol == "" {
			continue
		}
		uniqueSymbols[order.Symbol] = struct{}{}
	}

	trades := make([]models.TradeMessage, 0)
	for symbol := range uniqueSymbols {
		symbolTrades, err := h.Store.GetRecentTrades(symbol, int64(limit))
		if err != nil {
			response.WriteJson(w, http.StatusInternalServerError, response.GeneralError("failed to fetch trade history", err))
			return
		}

		for _, t := range symbolTrades {
			if t.MakerUserID == userID || t.TakerUserID == userID {
				trades = append(trades, t)
			}
		}
	}

	sort.Slice(trades, func(i, j int) bool {
		return trades[i].Timestamp > trades[j].Timestamp
	})

	if len(trades) > limit {
		trades = trades[:limit]
	}

	response.WriteJson(w, http.StatusOK, response.GeneralSuccess("trade history retrieved", map[string]interface{}{
		"trades": trades,
	}))
}

func (h *Handler) GetOrderHistory(w http.ResponseWriter, r *http.Request) {
	// Retrieve the order history for the user
	userID, ok := r.Context().Value(middleware.UserIDKey).(uint)
	if !ok {
		response.WriteJson(w, http.StatusUnauthorized, response.GeneralError("unauthorized", nil))
		return
	}

	orders, err := h.Store.GetOrdersByUser(userID)
	if err != nil {
		response.WriteJson(w, http.StatusInternalServerError, response.GeneralError("failed to fetch order history", err))
		return
	}

	response.WriteJson(w, http.StatusOK, response.GeneralSuccess("order history retrieved", map[string]interface{}{
		"orders": orders,
	}))
}
