package handlers

import (
	"github.com/GC-OpenSoft-2026/Algorithmic-Trading-Simulator/internal/database"
	"github.com/GC-OpenSoft-2026/Algorithmic-Trading-Simulator/internal/models"
	"github.com/GC-OpenSoft-2026/Algorithmic-Trading-Simulator/internal/storage"
)

// Handler is the core struct that holds your database connections.
// Every specific handler function will be attached to this struct.
type Handler struct {
	DB          *database.Connections
	OrderStream chan<- models.Order
	Store       *storage.Store
}

// New creates a new Handler instance with the injected databases
func New(db *database.Connections, orderStream chan<- models.Order, store *storage.Store) *Handler {
	return &Handler{
		DB:          db,
		OrderStream: orderStream,
		Store:       store,
	}
}
