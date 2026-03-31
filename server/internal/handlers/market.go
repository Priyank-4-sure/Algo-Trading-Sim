package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/GC-OpenSoft-2026/Algorithmic-Trading-Simulator/internal/utils/response"
	"github.com/go-chi/chi/v5"
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

func (h *Handler) GetMarketData(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	symbol := chi.URLParam(r, "symbol") // ← from /{symbol}

	// Load asset from Redis to get start price for this symbol
	assetStr, err := h.DB.Redis.HGet(ctx, "market:assets", symbol).Result()
	if err != nil {
		res := response.GeneralError("Symbol not found", err)
		response.WriteJson(w, http.StatusNotFound, res)
		return
	}

	var asset struct {
		Ticker     string  `json:"ticker"`
		StartPrice float64 `json:"start_price"`
	}
	if err := json.Unmarshal([]byte(assetStr), &asset); err != nil || asset.Ticker == "" {
		res := response.GeneralError("Failed to parse asset metadata", err)
		response.WriteJson(w, http.StatusInternalServerError, res)
		return
	}

	prices := h.Store.GetMarketPrices([]string{symbol}, map[string]float64{symbol: asset.StartPrice})

	res := response.GeneralSuccess("Market data retrieved successfully", prices[0])
	response.WriteJson(w, http.StatusOK, res)
}

func (h *Handler) GetMarketCandles(w http.ResponseWriter, r *http.Request) {
	symbol := chi.URLParam(r, "symbol")     // ← from /{symbol}
	interval := chi.URLParam(r, "interval") // ← from /{interval}

	if interval == "" {
		interval = "5s"
	}

	candles, err := h.Store.GetCandles(symbol, interval, 100)
	if err != nil {
		res := response.GeneralError("Failed to fetch candles", err)
		response.WriteJson(w, http.StatusInternalServerError, res)
		return
	}

	res := response.GeneralSuccess("Candles retrieved successfully", candles)
	response.WriteJson(w, http.StatusOK, res)
}
