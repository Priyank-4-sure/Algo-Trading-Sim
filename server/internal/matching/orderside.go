package matching

import (
	set "github.com/hashicorp/go-set"

	"github.com/GC-OpenSoft-2026/Algorithmic-Trading-Simulator/internal/models"
)

type OrderSide struct {
	Prices  map[float64]*OrderQueue
	Ordered *set.TreeSet[float64, set.Compare[float64]]
}

func NewOrderSide(isBid bool) *OrderSide {
	var cmp set.Compare[float64]

	if isBid {
		// Bids → highest price first (descending)
		cmp = func(a, b float64) int {
			if a > b {
				return -1
			}
			if a < b {
				return 1
			}
			return 0
		}
	} else {
		// Asks → lowest price first (ascending)
		cmp = func(a, b float64) int {
			if a < b {
				return -1
			}
			if a > b {
				return 1
			}
			return 0
		}
	}

	return &OrderSide{
		Prices:  make(map[float64]*OrderQueue),
		Ordered: set.NewTreeSet(cmp),
	}
}

func (os *OrderSide) Add(order models.Order, index map[string]*OrderNode) {
	q, ok := os.Prices[order.Price]
	if !ok {
		q = &OrderQueue{}
		os.Prices[order.Price] = q
		os.Ordered.Insert(order.Price)
	}
	node := q.Push(order)
	index[order.ID] = node
}

func (os *OrderSide) BestPrice() (float64, bool) {
	if os.Ordered.Empty() {
		return 0, false
	}
	return os.Ordered.Min(), true
}

func (os *OrderSide) NextPrice(price float64) (float64, bool) {
	next, ok := os.Ordered.FirstAbove(price)
	return next, ok
}

func (os *OrderSide) RemovePriceLevel(price float64) {
	delete(os.Prices, price)
	os.Ordered.Remove(price)
}

func (os *OrderSide) GetQueue(price float64) *OrderQueue {
	return os.Prices[price]
}

// AllPrices returns all active price levels in the TreeSet's natural order.
// For Bids (isBid=true): descending (highest first).
// For Asks (isBid=false): ascending (lowest first).
// The ascending parameter is kept for call-site clarity but the comparator
// already guarantees the correct order — Slice() honours it directly.
func (os *OrderSide) AllPrices(_ bool) []float64 {
	return os.Ordered.Slice()
}

// VolumeAt returns the total resting quantity at a given price level.
// Iterates the queue at that price level — O(N) where N = orders at that level.
// Called by emitLOBSnapshot and logOrderBookState in engine.go.
func (os *OrderSide) VolumeAt(price float64) int64 {
	q, ok := os.Prices[price]
	if !ok || q == nil || q.Empty() {
		return 0
	}
	var vol int64
	for node := q.Front(); node != nil; node = node.Next {
		vol += node.Order.Quantity
	}
	return vol
}
