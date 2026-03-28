package handlers

import "net/http"


func (h *Handler) GetPortfolio(w http.ResponseWriter, r *http.Request){
	// Retrieve the user's portfolio (e.g., current holdings, total value, etc.)
}

func (h *Handler) GetPortfolioHistory(w http.ResponseWriter, r *http.Request){
	// Retrieve the historical portfolio values for the user (e.g., for charting purposes)
}

func (h *Handler) ResetPortfolio(w http.ResponseWriter, r *http.Request){
	// Reset the user's portfolio to the initial state (e.g., for a new simulation run)
}
