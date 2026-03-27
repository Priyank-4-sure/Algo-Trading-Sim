package api

import (
	"net/http"

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
	r.Use(corsMiddleware)

	// WebSocket endpoint at root level — frontend connects to ws://host/ws?token=...
	r.Get("/ws", h.WSHandler)

	// API Version 1
	r.Route("/api/v1", func(r chi.Router) {
		r.Post("/auth/login", h.LoginHandler)
		r.Post("/auth/firebase", h.FirebaseLoginHandler)
		r.Post("/auth/refresh", h.RefreshHandler)
		r.Post("/auth/logout", h.LogoutHandler)
	})

	return r
}

// corsMiddleware allows cross-origin requests from the Vite dev server with cookie credentials
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" {
			w.Header().Set("Access-Control-Allow-Origin", origin)
		} else {
			w.Header().Set("Access-Control-Allow-Origin", "*")
		}
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}
		next.ServeHTTP(w, r)
	})
}
