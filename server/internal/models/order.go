package models

import (
	"encoding/json"
	"fmt"
	"math"
	"strings"
)

// ---------------------------------------------------------
// FIXED-POINT DECIMAL MATH
// ---------------------------------------------------------

// Decimal represents a fixed-point number for ultra-low latency arithmetic.
// Value stores the integer representation, Scale defines decimal places.
// e.g., Decimal{Value: 6423050, Scale: 2} == 64230.50
type Decimal struct {
	Value int64 `json:"value"`
	Scale int   `json:"scale"`
}

// Zero is the default zero Decimal value
var Zero = Decimal{Value: 0, Scale: 2}

// NewDecimal creates a Decimal from a float64 value with the given scale
func NewDecimal(value float64, scale int) Decimal {
	multiplier := math.Pow(10, float64(scale))
	return Decimal{
		Value: int64(math.Round(value * multiplier)),
		Scale: scale,
	}
}

// ToFloat64 converts the Decimal back to a float64
func (d Decimal) ToFloat64() float64 {
	return float64(d.Value) / math.Pow(10, float64(d.Scale))
}

// ToIndex returns the raw int64 value for use as a direct-mapped array index
func (d Decimal) ToIndex() int {
	return int(d.Value)
}

// Add returns d + other
func (d Decimal) Add(other Decimal) Decimal {
	return Decimal{Value: d.Value + other.Value, Scale: d.Scale}
}

// Sub returns d - other
func (d Decimal) Sub(other Decimal) Decimal {
	return Decimal{Value: d.Value - other.Value, Scale: d.Scale}
}

// GreaterThan returns true if d > other
func (d Decimal) GreaterThan(other Decimal) bool {
	return d.Value > other.Value
}

// GreaterThanOrEqual returns true if d >= other
func (d Decimal) GreaterThanOrEqual(other Decimal) bool {
	return d.Value >= other.Value
}

// LessThan returns true if d < other
func (d Decimal) LessThan(other Decimal) bool {
	return d.Value < other.Value
}

// Equal returns true if d == other
func (d Decimal) Equal(other Decimal) bool {
	return d.Value == other.Value
}

// String returns a human-readable representation
func (d Decimal) String() string {
	return fmt.Sprintf("%.2f", d.ToFloat64())
}

// MarshalJSON serializes Decimal as a plain float for JSON output
func (d Decimal) MarshalJSON() ([]byte, error) {
	return json.Marshal(d.ToFloat64())
}

// UnmarshalJSON deserializes a JSON number into a Decimal (scale 2)
func (d *Decimal) UnmarshalJSON(data []byte) error {
	var f float64
	if err := json.Unmarshal(data, &f); err != nil {
		return err
	}
	*d = NewDecimal(f, 2)
	return nil
}

// MinDecimal returns the smaller of two Decimals
func MinDecimal(a, b Decimal) Decimal {
	if a.LessThan(b) {
		return a
	}
	return b
}

// ---------------------------------------------------------
// HFT CONSTANTS
// ---------------------------------------------------------

// Side constants (int for performance)
const (
	SideBuy  = 1
	SideSell = 2
)

// OrderType constants (int for performance)
const (
	OrderTypeMarket = 1
	OrderTypeLimit  = 2
	OrderTypeCancel = 3
)

// Time-In-Force constants
const (
	TIFGTC = 1 // Good-Till-Cancelled
	TIFFOK = 2 // Fill-Or-Kill
	TIFIOC = 3 // Immediate-Or-Cancel
)

// MaxPriceLevel is the bound for the direct-mapped price array.
// Supports prices up to $100,000.00 at Scale=2 (100000 * 100 = 10,000,000)
const MaxPriceLevel = 10_000_000

// ---------------------------------------------------------
// ORDER (HFT-Compatible with JSON frontend compat)
// ---------------------------------------------------------

// Order represents a user's request to buy or sell.
// Uses Decimal for Price/Quantity and int for Side/OrderType for HFT performance.
type Order struct {
	ID          string  `json:"id"`
	Symbol      string  `json:"symbol"`
	Username    string  `json:"username"` // The owner of the order
	Side        int     `json:"side"`
	Price       Decimal `json:"price"`
	Quantity    Decimal `json:"quantity"`
	OriginalQty Decimal `json:"original_qty"`
	OrderType   int     `json:"type"`
	TIF         int     `json:"tif"`
	OCO         string  `json:"oco,omitempty"`
	IsActive    bool    `json:"is_active"`
	Timestamp   int64   `json:"timestamp"`
}

// orderJSON is the intermediate struct for custom JSON unmarshaling.
// It accepts both string ("BUY") and int (1) for Side/OrderType from the frontend.
type orderJSON struct {
	ID        string          `json:"id"`
	Symbol    string          `json:"symbol"`
	Username  string          `json:"username"`
	Side      json.RawMessage `json:"side"`
	Price     json.RawMessage `json:"price"`
	Quantity  json.RawMessage `json:"quantity"`
	Type      json.RawMessage `json:"type"`
	TIF       int             `json:"tif"`
	OCO       string          `json:"oco,omitempty"`
	Timestamp int64           `json:"timestamp"`
}

// UnmarshalJSON provides seamless conversion from frontend JSON (strings/floats)
// to the internal HFT representation (ints/Decimals)
func (o *Order) UnmarshalJSON(data []byte) error {
	var raw orderJSON
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}

	o.ID = raw.ID
	o.Symbol = raw.Symbol
	o.Username = raw.Username
	o.OCO = raw.OCO
	o.Timestamp = raw.Timestamp
	o.IsActive = true

	// Parse Side: accept string "BUY"/"SELL" or int 1/2
	if len(raw.Side) > 0 {
		var sideStr string
		if err := json.Unmarshal(raw.Side, &sideStr); err == nil {
			switch strings.ToUpper(sideStr) {
			case "BUY":
				o.Side = SideBuy
			case "SELL":
				o.Side = SideSell
			default:
				return fmt.Errorf("unknown side: %s", sideStr)
			}
		} else {
			var sideInt int
			if err := json.Unmarshal(raw.Side, &sideInt); err != nil {
				return fmt.Errorf("invalid side value")
			}
			o.Side = sideInt
		}
	}

	// Parse OrderType: accept string "LIMIT"/"MARKET"/"CANCEL" or int 1/2
	if len(raw.Type) > 0 {
		var typeStr string
		if err := json.Unmarshal(raw.Type, &typeStr); err == nil {
			switch strings.ToUpper(typeStr) {
			case "MARKET":
				o.OrderType = OrderTypeMarket
			case "LIMIT":
				o.OrderType = OrderTypeLimit
			case "CANCEL":
				o.OrderType = OrderTypeCancel
			default:
				o.OrderType = OrderTypeLimit // Default to Limit
			}
		} else {
			var typeInt int
			if err := json.Unmarshal(raw.Type, &typeInt); err != nil {
				return fmt.Errorf("invalid type value")
			}
			o.OrderType = typeInt
		}
	}

	// Parse Price: unmarshal as Decimal (float → Decimal with scale 2)
	if len(raw.Price) > 0 {
		if err := json.Unmarshal(raw.Price, &o.Price); err != nil {
			return fmt.Errorf("invalid price: %w", err)
		}
	}

	// Parse Quantity: accept int or float, convert to Decimal
	if len(raw.Quantity) > 0 {
		if err := json.Unmarshal(raw.Quantity, &o.Quantity); err != nil {
			return fmt.Errorf("invalid quantity: %w", err)
		}
	}

	// Set OriginalQty to match Quantity on creation
	o.OriginalQty = o.Quantity

	// Default TIF to GTC if not set
	if raw.TIF == 0 {
		o.TIF = TIFGTC
	} else {
		o.TIF = raw.TIF
	}

	return nil
}

// ---------------------------------------------------------
// TRADE MESSAGE (Frontend-compatible, uses plain types)
// ---------------------------------------------------------

type TradeMessage struct {
	Symbol        string  `json:"symbol"`
	MakerOrderID  string  `json:"maker_order_id"`
	TakerOrderID  string  `json:"taker_order_id"`
	MakerUsername string  `json:"maker_username"`
	TakerUsername string  `json:"taker_username"`
	TakerSide     int     `json:"taker_side"` // models.SideBuy or models.SideSell
	Price         float64 `json:"price"`
	Quantity      int64   `json:"quantity"`
	Timestamp     int64   `json:"timestamp"`
}