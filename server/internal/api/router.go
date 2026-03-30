package api

import (
	"github.com/GC-OpenSoft-2026/Algorithmic-Trading-Simulator/internal/api/middleware"
	"github.com/GC-OpenSoft-2026/Algorithmic-Trading-Simulator/internal/handlers"
	"github.com/go-chi/chi/v5"
	chiMiddleware "github.com/go-chi/chi/v5/middleware"
)

// SetupRouter creates the Chi router and maps URLs to the Handlers
func SetupRouter(h *handlers.Handler) *chi.Mux {
	r := chi.NewRouter()

	// Middleware
	r.Use(chiMiddleware.Logger)
	r.Use(chiMiddleware.Recoverer)

	// API Version 1
	r.Route("/v1", func(r chi.Router) {
		// Public Auth Routes
		r.Route("/auth", func(r chi.Router) {
			r.Post("/register", h.Register)
			r.Post("/login", h.Login)
			r.Post("/refresh", h.RefreshToken)
			r.Post("/logout", h.Logout)
		})

		r.Get("/ws", h.HandleWebSocket) // WebSocket endpoint

		// Public Market Data Routes
		r.Group(func(r chi.Router) {
			r.Get("/assets", h.GetAssets)
			r.Get("/marketdata/{symbol}", h.GetMarketData)
			r.Get("/candles/{symbol}/{interval}", h.GetMarketCandles)
			// r.Get("/orderbook/{symbol}", h.GetLobSnapshot)
		})

		// Protected Routes
		r.Group(func(r chi.Router) {
			r.Use(middleware.JWTMiddleware) // Apply JWT Auth Middleware

			// order Routes
			r.Route("/orders", func(r chi.Router) {
				r.Post("/", h.PlaceOrder)
				r.Delete("/{id}", h.CancelOrder)
				r.Get("/{id}", h.GetOrderStatus)
				r.Get("/active", h.GetActiveOrders)
				r.Get("/history", h.GetOrderHistory)
			})

			r.Get("/trades/history", h.GetTradeHistory)

			r.Route("/portfolio", func(r chi.Router) {
				r.Get("/history", h.GetPortfolioHistory)
				r.Post("/reset", h.ResetPortfolio)
			})
		})
	})

	return r
}
