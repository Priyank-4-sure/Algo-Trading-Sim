package handlers

import "github.com/GC-OpenSoft-2026/Algorithmic-Trading-Simulator/internal/database"

// Handler is the core struct that holds your database connections.
// Every specific handler function will be attached to this struct.
type Handler struct {
	DB *database.Connections
}

// New creates a new Handler instance with the injected databases
func New(db *database.Connections) *Handler {
	return &Handler{
		DB: db,
	}
}