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
        // Bids → highest price first
        cmp = func(a, b float64) int {
            if a > b { return -1 }
            if a < b { return 1 }
            return 0
        }
    } else {
        // Asks → lowest price first
        cmp = func(a, b float64) int {
            if a < b { return -1 }
            if a > b { return 1 }
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
