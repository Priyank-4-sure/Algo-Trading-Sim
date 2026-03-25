package models

// OrderType defines if it's a Limit, Market, or Cancel order
type OrderType string

const (
	Limit  OrderType = "LIMIT"
	Market OrderType = "MARKET"
	Cancel OrderType = "CANCEL"
)

// Side defines Buy or Sell
type Side string

const (
	Buy  Side = "BUY"
	Sell Side = "SELL"
)

// Order represents a user's request to buy or sell
type Order struct {
	ID        string    `json:"id"`
	Symbol    string    `json:"symbol"` // e.g."NXT", "AAPL"
	Type      OrderType `json:"type"`
	Side      Side      `json:"side"`
	Price     float64   `json:"price"` // 0 for Market orders
	Quantity  int64     `json:"quantity"`
	Timestamp int64     `json:"timestamp"` // Used for Time priority
}

// TradeMessage represents a completed execution
type TradeMessage struct {
	Symbol       string  `json:"symbol"` //So the frontend knows which chart to update
	MakerOrderID string  `json:"maker_order_id"`
	TakerOrderID string  `json:"taker_order_id"`
	Price        float64 `json:"price"`
	Quantity     int64   `json:"quantity"`
	Timestamp    int64   `json:"timestamp"`
}