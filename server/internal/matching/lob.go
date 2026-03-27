package matching

import (
	"sort"

	"github.com/GC-OpenSoft-2026/Algorithmic-Trading-Simulator/internal/models"
)

// ---------------------------------------------------------
// ORDER QUEUE — Direct-mapped array for O(1) price lookups
// ---------------------------------------------------------

// OrderQueue uses a fixed-size array where the index IS the price level.
// This avoids hash collisions, map lookups, and achieves O(1) access.
type OrderQueue struct {
	Queues [models.MaxPriceLevel]*[]models.Order
}

// Append adds an order to the queue at the given price index.
// Initializes the slice if this price level has never been used.
func (oq *OrderQueue) Append(priceIdx int, order models.Order) {
	if oq.Queues[priceIdx] == nil {
		queue := make([]models.Order, 0, 4)
		oq.Queues[priceIdx] = &queue
	}
	*oq.Queues[priceIdx] = append(*oq.Queues[priceIdx], order)
}

// ---------------------------------------------------------
// ORDER SIDE — Manages one side (Bid or Ask) of the LOB
// ---------------------------------------------------------

// OrderSide tracks sorted price levels and the direct-mapped queue
type OrderSide struct {
	Prices []int      // Sorted price indices with active orders
	Queue  OrderQueue // Direct-mapped array
	IsBid  bool       // Determines sort direction
}

// NewOrderSideAsk creates a new Ask side (prices sorted ascending — lowest first)
func NewOrderSideAsk() *OrderSide {
	return &OrderSide{
		Prices: make([]int, 0),
		IsBid:  false,
	}
}

// NewOrderSideBid creates a new Bid side (prices sorted descending — highest first)
func NewOrderSideBid() *OrderSide {
	return &OrderSide{
		Prices: make([]int, 0),
		IsBid:  true,
	}
}

// insertPriceSorted inserts a price index into the sorted Prices slice
func (os *OrderSide) insertPriceSorted(priceIdx int) {
	// Check if already exists
	for _, p := range os.Prices {
		if p == priceIdx {
			return
		}
	}

	os.Prices = append(os.Prices, priceIdx)

	if os.IsBid {
		// Descending (highest first for bids)
		sort.Slice(os.Prices, func(i, j int) bool {
			return os.Prices[i] > os.Prices[j]
		})
	} else {
		// Ascending (lowest first for asks)
		sort.Ints(os.Prices)
	}
}

// removePriceSorted removes a price index from the sorted Prices slice
func (os *OrderSide) removePriceSorted(priceIdx int) {
	for i, p := range os.Prices {
		if p == priceIdx {
			os.Prices = append(os.Prices[:i], os.Prices[i+1:]...)
			return
		}
	}
}

// Append adds an order to this side of the book
func (os *OrderSide) Append(order models.Order) {
	priceIdx := order.Price.ToIndex()
	os.insertPriceSorted(priceIdx)
	os.Queue.Append(priceIdx, order)
}

// ---------------------------------------------------------
// ORDER BOOK — Full book for one symbol
// ---------------------------------------------------------

// OrderBook manages both sides (Bids and Asks) for a single symbol
type OrderBook struct {
	Bids   *OrderSide
	Asks   *OrderSide
	Orders map[string]*models.Order // ID → Order pointer for O(1) cancels/OCO
}

// NewOrderBook creates an initialized OrderBook for a symbol
func NewOrderBook() *OrderBook {
	return &OrderBook{
		Bids:   NewOrderSideBid(),
		Asks:   NewOrderSideAsk(),
		Orders: make(map[string]*models.Order),
	}
}

// CancelOrder logically deactivates an order by ID (logical deletion)
func (ob *OrderBook) CancelOrder(orderID string) bool {
	order, exists := ob.Orders[orderID]
	if !exists {
		return false
	}
	order.IsActive = false
	delete(ob.Orders, orderID)
	return true
}

// canFullyFill checks if a FOK order can be completely filled
// by scanning the opposing side's resting orders
func (ob *OrderBook) canFullyFill(side int, price models.Decimal, qty models.Decimal) bool {
	var opposingSide *OrderSide
	if side == models.SideBuy {
		opposingSide = ob.Asks
	} else {
		opposingSide = ob.Bids
	}

	remaining := qty

	for _, priceIdx := range opposingSide.Prices {
		// Check price compatibility
		levelPrice := models.Decimal{Value: int64(priceIdx), Scale: price.Scale}
		if side == models.SideBuy && levelPrice.GreaterThan(price) {
			break // Ask price too high for buyer
		}
		if side == models.SideSell && levelPrice.LessThan(price) {
			break // Bid price too low for seller
		}

		queue := opposingSide.Queue.Queues[priceIdx]
		if queue == nil {
			continue
		}

		for _, order := range *queue {
			if !order.IsActive {
				continue
			}
			fillQty := models.MinDecimal(remaining, order.Quantity)
			remaining = remaining.Sub(fillQty)
			if remaining.Equal(models.Zero) || remaining.LessThan(models.Zero) {
				return true
			}
		}
	}

	return remaining.Equal(models.Zero) || remaining.LessThan(models.Zero)
}
