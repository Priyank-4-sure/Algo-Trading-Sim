package handlers

import "net/http"

func (h *Handler) GetAssets(w http.ResponseWriter, r *http.Request){
	// Retrieve the list of available assets (e.g., stock symbols, their current prices, etc.)
}

func (h *Handler) GetMarketData(w http.ResponseWriter, r *http.Request){
	// Retrieve the market data for a specific asset (e.g., price history, current price, etc.)
}

func (h *Handler) GetMarketCandles(w http.ResponseWriter, r *http.Request){
	// Retrieve the candlestick data for a specific asset and interval (e.g., 1m, 5m, 1h, etc.)
}

func (h *Handler) GetLobSnapshot(w http.ResponseWriter, r *http.Request){
	// Retrieve the current limit order book snapshot for a specific asset (e.g., top 5 levels of bids and asks)
}
