package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/GC-OpenSoft-2026/Algorithmic-Trading-Simulator/internal/utils/response"
)

func (h *Handler) GetAssets(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	assetsMap, err := h.DB.Redis.HGetAll(ctx, "market:assets").Result()
	if err != nil {
		res := response.GeneralError("Failed to fetch assets", err)
		response.WriteJson(w, http.StatusInternalServerError, res)
		return
	}

	var assets []map[string]interface{}
	for _, assetStr := range assetsMap {
		var asset map[string]interface{}
		if err := json.Unmarshal([]byte(assetStr), &asset); err == nil {
			assets = append(assets, asset)
		}
	}

	res := response.GeneralSuccess("Assets retrieved successfully", assets)
	response.WriteJson(w, http.StatusOK, res)
}

func (h *Handler) GetMarketData(w http.ResponseWriter, r *http.Request){
	// Retrieve the market data for a specific asset (e.g., price history, current price, etc.)
}

func (h *Handler) GetMarketCandles(w http.ResponseWriter, r *http.Request){
	// Retrieve the candlestick data for a specific asset and interval (e.g., 1m, 5m, 1h, etc.)
}

// func (h *Handler) GetLobSnapshot(w http.ResponseWriter, r *http.Request) {
// 	ctx := r.Context()
// 	ticker := r.URL.Query().Get("ticker")

// 	if ticker == "" {
// 		res := response.GeneralError("Missing 'ticker' query parameter", nil)
// 		response.WriteJson(w, http.StatusBadRequest, res)
// 		return
// 	}

// 	redisKey := "market:lob:" + ticker
// 	snapshotStr, err := h.DB.Redis.Get(ctx, redisKey).Result()

// 	if err == redis.Nil {
// 		res := response.GeneralError("Order book snapshot not found", nil)
// 		response.WriteJson(w, http.StatusNotFound, res)
// 		return
// 	} else if err != nil {
// 		res := response.GeneralError("Database connection error", err)
// 		response.WriteJson(w, http.StatusInternalServerError, res)
// 		return
// 	}

// 	// Unmarshal into a map
// 	var snapshot map[string]interface{}
// 	json.Unmarshal([]byte(snapshotStr), &snapshot)

// 	res := response.GeneralSuccess("Limit order book retrieved successfully", snapshot)
// 	response.WriteJson(w, http.StatusOK, res)
// }
