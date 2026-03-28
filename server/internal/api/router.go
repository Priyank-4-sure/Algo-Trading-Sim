package api

import (
	"github.com/GC-OpenSoft-2026/Algorithmic-Trading-Simulator/internal/handlers"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

// SetupRouter creates the Chi router and maps URLs to the Handlers
func SetupRouter(h *handlers.Handler) *chi.Mux {
	r := chi.NewRouter()

	// Middleware
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	// API Version 1
	r.Route("/v1", func(r chi.Router) {
		// all routes will be defined here, e.g.:
		r.Get("/ws", h.HandleWebSocket) // WebSocket endpoint

		r.Group(func(r chi.Router) {
			r.Post("/orders", h.PlaceOrder)         
			r.Delete("/orders/{id}", h.CancelOrder) 
			r.Get("/orders/{id}", h.GetOrderStatus)
			r.Get("/orders/active", h.GetActiveOrders)
			r.Get("/orders/history", h.GetOrderHistory)
			r.Get("/trades/history", h.GetTradeHistory)
		})

		r.Group(func(r chi.Router) {
			r.Get("/assets", h.GetAssets)
			r.Get("/marketdata/{symbol}", h.GetMarketData)
			r.Get("/candles/{symbol}/{interval}", h.GetMarketCandles)
			r.Get("/orderbook/{symbol}", h.GetLobSnapshot)
		})

		r.Group(func(r chi.Router) {
			r.Get("/portfolio", h.GetPortfolio)
			r.Get("/portfolio/history", h.GetPortfolioHistory)
			r.Post("/portfolio/reset", h.ResetPortfolio)
		})
	})

	return r
}
