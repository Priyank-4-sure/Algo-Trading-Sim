package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"

	"github.com/GC-OpenSoft-2026/Algorithmic-Trading-Simulator/internal/api/middleware"
	"github.com/GC-OpenSoft-2026/Algorithmic-Trading-Simulator/internal/models"
	"github.com/GC-OpenSoft-2026/Algorithmic-Trading-Simulator/internal/utils/response"
)

func (h *Handler) GetPortfolio(w http.ResponseWriter, r *http.Request) {

	ctxValue := r.Context().Value(middleware.UserIDKey)

	userID, ok := ctxValue.(uint)

	if !ok {
		response.WriteJson(w, http.StatusBadRequest, response.GeneralError("Invalid user ID in context", nil))
		return
	}

	var portfolio models.Portfolio
	result := h.DB.Primary.Preload("Holdings").First(&portfolio, "user_id = ?", userID)

	if result.Error != nil {
		response.WriteJson(w, http.StatusInternalServerError, response.GeneralError("Failed to retrieve portfolio", result.Error))
		return
	}
	response.WriteJson(w, http.StatusOK, response.GeneralSuccess("Portfolio retrieved successfully", portfolio))
}

func (h *Handler) GetPortfolioHistory(w http.ResponseWriter, r *http.Request) {
	// 1. Safely extract the User ID from the context (Assuming it's a uint from JWT)
	ctxValue := r.Context().Value(middleware.UserIDKey)
	if ctxValue == nil {
		response.WriteJson(w, http.StatusUnauthorized, response.GeneralError("Unauthorized access", nil))
		return
	}
	userID := ctxValue.(uint)
	userIDStr := fmt.Sprintf("%d", userID) // Convert to string for Redis keys
	ctx := r.Context()

	// ==========================================
	// PART 1: Fetch Orders from Redis
	// ==========================================
	var orders []models.Order = []models.Order{} // Initialize as empty array so JSON doesn't return null

	indexKey := "orders:user:" + userIDStr
	orderIDs, err := h.DB.Redis.ZRange(ctx, indexKey, 0, -1).Result()
	if err != nil {
		response.WriteJson(w, http.StatusInternalServerError, response.GeneralError("Failed to fetch order index", err))
		return
	}

	// Only attempt MGET if the user actually has orders
	if len(orderIDs) > 0 {
		var keys []string
		for _, id := range orderIDs {
			keys = append(keys, "order:"+id)
		}

		rawOrders, err := h.DB.Redis.MGet(ctx, keys...).Result()
		if err != nil {
			response.WriteJson(w, http.StatusInternalServerError, response.GeneralError("Failed to fetch orders from Redis", err))
			return
		}

		for i, raw := range rawOrders {
			if raw == nil {
				continue // Skip expired orders
			}

			var o models.Order
			if err := json.Unmarshal([]byte(raw.(string)), &o); err == nil {
				orders = append(orders, o)
			} else {
				log.Printf("Failed to unmarshal order %s: %v", orderIDs[i], err)
			}
		}
	}

	// ==========================================
	// PART 2: Fetch Holdings via Portfolio from Postgres
	// ==========================================
	var portfolio models.Portfolio
	if err := h.DB.Primary.Preload("Holdings").Where("user_id = ?", userID).First(&portfolio).Error; err != nil {
		response.WriteJson(w, http.StatusInternalServerError, response.GeneralError("Failed to retrieve portfolio", err))
		return
	}
	holdings := portfolio.Holdings

	// ==========================================
	// PART 3: Fetch Trades from TimescaleDB
	// ==========================================
	trades, err := h.store.GetTradesByUserID(userID)
	if err != nil {
		response.WriteJson(w, http.StatusInternalServerError, response.GeneralError("Failed to retrieve trades", err))
		return
	}

	// ==========================================
	// PART 4: Serve the Combined JSON
	// ==========================================
	response.WriteJson(w, http.StatusOK, map[string]interface{}{
		"status":  "success",
		"message": "Portfolio history retrieved successfully",
		"data": map[string]interface{}{
			"orders":   orders,
			"holdings": holdings,
			"trades":   trades,
		},
	})
}

func (h *Handler) ResetPortfolio(w http.ResponseWriter, r *http.Request) {
	// Reset the user's portfolio to the initial state (e.g., for a new simulation run)
	CtxValue := r.Context().Value(middleware.UserIDKey)
	userID, ok := CtxValue.(uint)

	if !ok {
		response.WriteJson(w, http.StatusBadRequest, response.GeneralError("Invalid user ID in context", nil))
		return
	}

	// Fetch portfolio first to get the portfolio ID
	var portfolio models.Portfolio
	result := h.DB.Primary.Where("user_id = ?", userID).First(&portfolio)
	if result.Error != nil {
		response.WriteJson(w, http.StatusInternalServerError, response.GeneralError("Failed to reset portfolio", result.Error))
		return
	}

	// Clear holdings by portfolio_id (Holding has PortfolioID, not UserID)
	var Holdings []models.Holding
	result = h.DB.Primary.Where("portfolio_id = ?", portfolio.ID).Delete(&Holdings)
	if result.Error != nil {
		response.WriteJson(w, http.StatusInternalServerError, response.GeneralError("Failed to reset portfolio", result.Error))
		return
	}

	// Reset User Balance
	portfolio.Balance = 100000.00 // Reset to initial balance
	result = h.DB.Primary.Save(&portfolio)

	if result.Error != nil {
		response.WriteJson(w, http.StatusInternalServerError, response.GeneralError("Failed to reset portfolio", result.Error))
		return
	}

	response.WriteJson(w, http.StatusOK, response.GeneralSuccess("Portfolio reset successfully", nil))

}

// CreatePortfolio creates a new portfolio entry for a user with an initial balance.
// This is called during user registration to ensure every user starts with a portfolio.
func (h *Handler) CreatePortfolio(userID uint) error {
	portfolio := models.Portfolio{
		UserID:  userID,
		Balance: 100000.00, // Initial balance
	}
	if err := h.DB.Primary.Create(&portfolio).Error; err != nil {
		return fmt.Errorf("failed to create portfolio for user %d: %w", userID, err)
	}
	return nil
}
