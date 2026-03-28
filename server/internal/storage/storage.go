package storage

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/GC-OpenSoft-2026/Algorithmic-Trading-Simulator/internal/models"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

// ---- TimescaleDB Table Models (GORM) ----

type OrderRecord struct {
	ID        string `gorm:"primaryKey"`
	UserID    string `gorm:"index"`
	Symbol    string `gorm:"index"`
	Type      string
	Side      string
	Price     float64
	Quantity  int64
	FilledQty int64     `gorm:"default:0"`
	Status    string    `gorm:"default:'OPEN'"` // OPEN | PARTIAL | FILLED | CANCELLED
	CreatedAt time.Time `gorm:"index"`          // index for time-range queries
}

// TradeRecord maps to a TimescaleDB hypertable partitioned by ExecutedAt
type TradeRecord struct {
	ID           string `gorm:"primaryKey"`
	Symbol       string `gorm:"index"`
	Price        float64
	Quantity     int64
	MakerOrderID string
	TakerOrderID string
	ExecutedAt   time.Time `gorm:"index"` // hypertable partition key
}

// CandleRecord is NOT created by Go — it is a TimescaleDB continuous aggregate view.
// This struct is READ-ONLY, used only for querying candles_1s and candles_5s views.
type CandleRecord struct {
	Symbol string    `gorm:"column:symbol"`
	Bucket time.Time `gorm:"column:bucket"`
	Open   float64   `gorm:"column:open"`
	High   float64   `gorm:"column:high"`
	Low    float64   `gorm:"column:low"`
	Close  float64   `gorm:"column:close"`
	Volume int64     `gorm:"column:volume"`
}

// ---- Store ----

type Store struct {
	tsdb  *gorm.DB // TimescaleDB — trades, orders, candles
	redis *redis.Client
	ctx   context.Context
}

func NewStore(tsdb *gorm.DB, rdb *redis.Client) *Store {
	return &Store{
		tsdb:  tsdb,
		redis: rdb,
		ctx:   context.Background(),
	}
}

// ---- InitSchema ----
// Creates tables and TimescaleDB hypertable + continuous aggregates.
// Safe to call on every startup — all statements use IF NOT EXISTS.

func InitSchema(tsdb *gorm.DB) error {
	log.Println("[Storage] Running schema migration...")

	// 1. Create orders table
	if err := tsdb.AutoMigrate(&OrderRecord{}); err != nil {
		return fmt.Errorf("orders migration failed: %w", err)
	}

	// 2. Create trades table
	if err := tsdb.AutoMigrate(&TradeRecord{}); err != nil {
		return fmt.Errorf("trades migration failed: %w", err)
	}

	// 3. Convert trades to a hypertable (partitioned by executed_at)
	// Safe to run multiple times — IF NOT EXISTS equivalent via exception handling
	tsdb.Exec(`
		SELECT create_hypertable('trade_records', 'executed_at', 
		if_not_exists => TRUE, 
		migrate_data  => TRUE)
	`)

	// 4. Create 1-second candle continuous aggregate
	tsdb.Exec(`
		CREATE MATERIALIZED VIEW IF NOT EXISTS candles_1s
		WITH (timescaledb.continuous) AS
		SELECT
			symbol,
			time_bucket('1 second', executed_at)  AS bucket,
			FIRST(price, executed_at)              AS open,
			MAX(price)                             AS high,
			MIN(price)                             AS low,
			LAST(price, executed_at)               AS close,
			SUM(quantity)                          AS volume
		FROM trade_records
		GROUP BY symbol, bucket
		WITH NO DATA
	`)

	// 5. Create 5-second candle continuous aggregate
	tsdb.Exec(`
		CREATE MATERIALIZED VIEW IF NOT EXISTS candles_5s
		WITH (timescaledb.continuous) AS
		SELECT
			symbol,
			time_bucket('5 seconds', executed_at) AS bucket,
			FIRST(price, executed_at)             AS open,
			MAX(price)                            AS high,
			MIN(price)                            AS low,
			LAST(price, executed_at)              AS close,
			SUM(quantity)                         AS volume
		FROM trade_records
		GROUP BY symbol, bucket
		WITH NO DATA
	`)

	// 6. Add automatic refresh policies so views stay up-to-date
	tsdb.Exec(`
		SELECT add_continuous_aggregate_policy('candles_1s',
			start_offset => INTERVAL '10 minutes',
			end_offset   => INTERVAL '1 second',
			schedule_interval => INTERVAL '1 second',
			if_not_exists => TRUE)
	`)
	tsdb.Exec(`
		SELECT add_continuous_aggregate_policy('candles_5s',
			start_offset => INTERVAL '10 minutes',
			end_offset   => INTERVAL '5 seconds',
			schedule_interval => INTERVAL '5 seconds',
			if_not_exists => TRUE)
	`)

	log.Println("[Storage] Schema ready.")
	return nil
}

// ---- InsertOrder ----
func (s *Store) InsertOrder(order models.Order) {
	if order.Type == models.Cancel {
		return
	}

	go func(order models.Order) {
		key := "order:" + order.ID
		data, err := json.Marshal(order)
		if err != nil {
			log.Printf("[Storage] InsertOrder marshal failed for %s: %v", order.ID, err)
			return
		}

		// Primary record — full order JSON, expires in 24h
		if err := s.redis.Set(s.ctx, key, data, 24*time.Hour).Err(); err != nil {
			log.Printf("[Storage] InsertOrder Redis set failed for %s: %v", order.ID, err)
			return
		}

		score := float64(time.Now().UnixNano())
		userIdStr := fmt.Sprintf("%d", order.UserID)

		// Index by user ID — so we can fetch all orders for a user
		s.redis.ZAdd(s.ctx, "orders:user:"+userIdStr, redis.Z{
			Score:  score,
			Member: order.ID,
		})

		// Index by symbol — open orders per symbol
		s.redis.ZAdd(s.ctx, "orders:open:"+order.Symbol, redis.Z{
			Score:  score,
			Member: order.ID,
		})

		log.Printf("[Storage] InsertOrder stored in Redis: %s (user=%s symbol=%s)",
			order.ID, userIdStr, order.Symbol)
	}(order)
}

// ---- StartPipeline ----
// FIX 1 & 3: StartPipeline now only owns the LOB snapshot channel.
//
// Previously the signature was StartPipeline(tradeStream, lobStream), which
// launched an internal goroutine consuming tradeStream. main.go's trade goroutine
// ALSO reads from tradeStream — two goroutines competing on one channel.
// Go delivers each message to exactly one receiver, so trades would be randomly
// split between the two consumers, breaking both persistence and tickerTape.
//
// The correct design (matching main.go's comment "Single trade consumer — owns
// tradeStream exclusively") is for main.go's goroutine to be the sole consumer
// of tradeStream and call HandleTrade directly. StartPipeline only manages the
// LOB snapshot pipeline.

func (s *Store) StartPipeline(lobStream <-chan models.LOBSnapshot) {
	go func() {
		for snap := range lobStream {
			s.handleLOBSnapshot(snap)
		}
	}()

	log.Println("[Storage] LOB snapshot pipeline started.")
}

// ---- HandleTrade ----
// FIX 2: Exported so main.go's trade goroutine can call it directly.
//
// Previously this was handleTrade (unexported), causing a compile error:
// "store.HandleTrade undefined". main.go is the sole consumer of tradeStream
// and calls HandleTrade for each matched trade.

func (s *Store) HandleTrade(trade models.TradeMessage) {

	// 1. Persist raw trade to TimescaleDB hypertable.
	// TimescaleDB continuous aggregate will auto-compute candles from this.
	record := TradeRecord{
		ID:           fmt.Sprintf("%s-%d", trade.TakerOrderID, trade.Timestamp),
		Symbol:       trade.Symbol,
		Price:        trade.Price,
		Quantity:     trade.Quantity,
		MakerOrderID: trade.MakerOrderID,
		TakerOrderID: trade.TakerOrderID,
		ExecutedAt:   time.Unix(0, trade.Timestamp),
	}
	if err := s.tsdb.Create(&record).Error; err != nil {
		log.Printf("[Storage] InsertTrade failed: %v", err)
	}

	// 2. Update order fill status in TimescaleDB (atomic transaction)
	s.updateOrderStatus(trade.MakerOrderID, trade.Quantity)
	s.updateOrderStatus(trade.TakerOrderID, trade.Quantity)

	// 3. Update Redis: current in-progress candle (sub-second hot path)
	s.updateCurrentCandle(trade)

	// 4. Update Redis: recent trades ring buffer (last 50)
	tradeJSON, _ := json.Marshal(trade)
	key := "trades:recent:" + trade.Symbol
	s.redis.LPush(s.ctx, key, string(tradeJSON))
	s.redis.LTrim(s.ctx, key, 0, 49)
}

// updateOrderStatus wraps both SQL statements in a single transaction.
// Without this, a crash between the two statements would leave filled_qty
// incremented but status stale (e.g. stuck on OPEN).

func (s *Store) updateOrderStatus(orderID string, filledQty int64) {
	err := s.tsdb.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&OrderRecord{}).
			Where("id = ?", orderID).
			UpdateColumn("filled_qty", gorm.Expr("filled_qty + ?", filledQty)).Error; err != nil {
			return fmt.Errorf("failed to update filled_qty for order %s: %w", orderID, err)
		}

		if err := tx.Exec(`
			UPDATE order_records SET status =
				CASE
					WHEN filled_qty >= quantity THEN 'FILLED'
					WHEN filled_qty > 0         THEN 'PARTIAL'
					ELSE 'OPEN'
				END
			WHERE id = ?`, orderID).Error; err != nil {
			return fmt.Errorf("failed to update status for order %s: %w", orderID, err)
		}

		return nil
	})

	if err != nil {
		log.Printf("[Storage] updateOrderStatus failed for order %s: %v", orderID, err)
	}
}

// ---- Redis: Current In-Progress Candle ----
// Sub-second hot candle for WebSocket broadcast. Does NOT replace TimescaleDB
// candles — it is the "live" candle for the current second only.

type CurrentCandle struct {
	Open       float64   `json:"open"`
	High       float64   `json:"high"`
	Low        float64   `json:"low"`
	Close      float64   `json:"close"`
	Volume     int64     `json:"volume"`
	BucketTime time.Time `json:"bucket_time"`
}

func (s *Store) updateCurrentCandle(trade models.TradeMessage) {
	key := "candle:current:" + trade.Symbol
	now := time.Now().Truncate(time.Second)

	raw, err := s.redis.Get(s.ctx, key).Result()
	if err != nil {
		// No candle yet for this symbol — create the first one.
		candle := CurrentCandle{
			Open:       trade.Price,
			High:       trade.Price,
			Low:        trade.Price,
			Close:      trade.Price,
			Volume:     trade.Quantity,
			BucketTime: now,
		}
		data, _ := json.Marshal(candle)
		s.redis.Set(s.ctx, key, data, 0)
		return
	}

	var candle CurrentCandle
	json.Unmarshal([]byte(raw), &candle)

	// Second boundary crossed — reset to a fresh candle.
	// The previous second's data is already in TimescaleDB via the hypertable insert.
	if !now.Equal(candle.BucketTime) {
		candle = CurrentCandle{
			Open:       trade.Price,
			High:       trade.Price,
			Low:        trade.Price,
			Close:      trade.Price,
			Volume:     trade.Quantity,
			BucketTime: now,
		}
		data, _ := json.Marshal(candle)
		s.redis.Set(s.ctx, key, data, 0)
		return
	}

	// Same second — update OHLCV normally.
	if trade.Price > candle.High {
		candle.High = trade.Price
	}
	if trade.Price < candle.Low {
		candle.Low = trade.Price
	}
	candle.Close = trade.Price
	candle.Volume += trade.Quantity

	data, _ := json.Marshal(candle)
	s.redis.Set(s.ctx, key, data, 0)
}

// ---- LOB Snapshot Handler ----
// FIX 4: Added redis.Publish alongside redis.Set so WebSocket clients
// subscribed to "orderbook:<symbol>" via ws.go's streamOrderbook actually
// receive messages.
//
// Previously only redis.Set was called — a key-value write that is invisible
// to Pub/Sub subscribers. ws.go's streamOrderbook subscribes to the
// "orderbook:<symbol>" Pub/Sub channel and was silently hanging forever
// because nothing ever published to it.

func (s *Store) handleLOBSnapshot(snap models.LOBSnapshot) {
	data, _ := json.Marshal(snap)
	key := "orderbook:" + snap.Symbol

	// Write the current state for REST/GET polling
	s.redis.Set(s.ctx, key, data, 0)

	// Publish to Pub/Sub so WebSocket subscribers in ws.go receive the update
	s.redis.Publish(s.ctx, key, data)

	// Write mid-price as a cheap scalar for clients that only need a price feed
	s.redis.Set(s.ctx, "midprice:"+snap.Symbol,
		fmt.Sprintf("%.4f", snap.MidPrice), 0)
}

// ---- REST API Helpers ----

// GetOrderBook returns current LOB from Redis
func (s *Store) GetOrderBook(symbol string) (*models.LOBSnapshot, error) {
	raw, err := s.redis.Get(s.ctx, "orderbook:"+symbol).Result()
	if err != nil {
		return nil, fmt.Errorf("no order book for symbol: %s", symbol)
	}
	var snap models.LOBSnapshot
	json.Unmarshal([]byte(raw), &snap)
	return &snap, nil
}

// GetRecentTrades returns last N trades from Redis ring buffer
func (s *Store) GetRecentTrades(symbol string, n int64) ([]models.TradeMessage, error) {
	raws, err := s.redis.LRange(s.ctx, "trades:recent:"+symbol, 0, n-1).Result()
	if err != nil {
		return nil, err
	}
	trades := make([]models.TradeMessage, 0, len(raws))
	for _, raw := range raws {
		var t models.TradeMessage
		json.Unmarshal([]byte(raw), &t)
		trades = append(trades, t)
	}
	return trades, nil
}

// GetCandles queries TimescaleDB continuous aggregate view.
// interval: "1s" or "5s"
func (s *Store) GetCandles(symbol, interval string, limit int) ([]CandleRecord, error) {
	view := "candles_1s"
	if interval == "5s" {
		view = "candles_5s"
	}
	var candles []CandleRecord
	err := s.tsdb.
		Raw(fmt.Sprintf(`
			SELECT symbol, bucket, open, high, low, close, volume
			FROM %s
			WHERE symbol = ?
			ORDER BY bucket DESC
			LIMIT ?`, view),
			symbol, limit).
		Scan(&candles).Error
	return candles, err
}

// GetOrderByID returns a single order by its ID — O(1) direct lookup
func (s *Store) GetOrderByID(orderID string) (*models.Order, error) {
	raw, err := s.redis.Get(s.ctx, "order:"+orderID).Result()
	if err != nil {
		return nil, fmt.Errorf("order %s not found", orderID)
	}
	var order models.Order
	if err := json.Unmarshal([]byte(raw), &order); err != nil {
		return nil, err
	}
	return &order, nil
}

// GetOrdersByUser returns all orders for a user, newest first
func (s *Store) GetOrdersByUser(userID string) ([]models.Order, error) {
	ids, err := s.redis.ZRevRange(s.ctx, "orders:user:"+userID, 0, -1).Result()
	if err != nil || len(ids) == 0 {
		return []models.Order{}, nil
	}

	keys := make([]string, len(ids))
	for i, id := range ids {
		keys[i] = "order:" + id
	}

	raws, err := s.redis.MGet(s.ctx, keys...).Result()
	if err != nil {
		return nil, fmt.Errorf("GetOrdersByUser MGet failed: %w", err)
	}

	orders := make([]models.Order, 0, len(raws))
	for _, raw := range raws {
		if raw == nil {
			continue // TTL expired — index entry outlived the data
		}
		var o models.Order
		if err := json.Unmarshal([]byte(raw.(string)), &o); err == nil {
			orders = append(orders, o)
		}
	}
	return orders, nil
}

// GetCurrentCandle returns the live in-progress candle from Redis
func (s *Store) GetCurrentCandle(symbol string) (*CurrentCandle, error) {
	raw, err := s.redis.Get(s.ctx, "candle:current:"+symbol).Result()
	if err != nil {
		return nil, err
	}
	var candle CurrentCandle
	json.Unmarshal([]byte(raw), &candle)
	return &candle, nil
}

// GetMidPrice returns current mid price from Redis
func (s *Store) GetMidPrice(symbol string) (string, error) {
	return s.redis.Get(s.ctx, "midprice:"+symbol).Result()
}
