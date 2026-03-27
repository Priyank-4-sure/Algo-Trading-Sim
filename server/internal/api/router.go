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
	})

	return r
}
