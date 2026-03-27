package matching

import (
	"github.com/GC-OpenSoft-2026/Algorithmic-Trading-Simulator/internal/models"
)

// OrderNode is a node in the per-price doubly linked list.
// It wraps a pointer into the LOB's direct-mapped slice to allow O(1) cancel lookups.
//
// Architecture note: We use the HFT direct-mapped array (lob.go) as the primary storage
// for price levels. OrderNode / OrderIndex is an overlay map: orderID → (priceIdx, sliceIdx)
// so CancelOrder is O(1) instead of O(N scan).
type OrderNode struct {
	Order    *models.Order // Pointer into OrderSide.Queue.Queues[priceIdx] slice
	PriceIdx int           // Which price bucket the order lives in
	QueueIdx int           // Which index within that bucket slice
}

// OrderIndex is a map from order ID to its location, enabling O(1) cancellation.
// It is stored in the Engine (one per symbol book) rather than in OrderBook to keep
// the HFT OrderBook zero-allocation on the hot path.
type OrderIndex map[string]*OrderNode

// NewOrderIndex creates a fresh OrderIndex.
func NewOrderIndex() OrderIndex {
	return make(OrderIndex)
}

// Track registers an order into the index. Must be called after the order is appended
// to the LOB direct-mapped array.
func (idx OrderIndex) Track(order *models.Order, priceIdx int, queueIdx int) {
	idx[order.ID] = &OrderNode{
		Order:    order,
		PriceIdx: priceIdx,
		QueueIdx: queueIdx,
	}
}

// Forget removes an order from the index (e.g. after fill or cancel).
func (idx OrderIndex) Forget(orderID string) {
	delete(idx, orderID)
}

// Lookup finds the node for an order ID. Returns nil if not found.
func (idx OrderIndex) Lookup(orderID string) *OrderNode {
	return idx[orderID]
}

// these functions allow push, cancel order in O(1) time
// combined with the direct-mapped array they give best-of-both worlds:
//   - O(1) price level access (direct-mapped array)
//   - O(1) cancel by order ID (OrderIndex map)