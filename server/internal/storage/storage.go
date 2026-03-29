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
	UserID    uint   `gorm:"index"`
	Symbol    string `gorm:"index"`
	Type      string
	Side      string
	Price     float64
	Quantity  int64
	FilledQty int64     `gorm:"default:0"`
	Status    string    `gorm:"default:'OPEN'"`
	CreatedAt time.Time `gorm:"index"`
}

// TradeRecord — composite PK (id, executed_at) required by TimescaleDB
// so that executed_at (the partition column) is included in every unique index.
type TradeRecord struct {
	ID           string    `gorm:"column:id"`
	Symbol       string    `gorm:"column:symbol;index"`
	Price        float64   `gorm:"column:price"`
	Quantity     int64     `gorm:"column:quantity"`
	MakerOrderID string    `gorm:"column:maker_order_id"`
	TakerOrderID string    `gorm:"column:taker_order_id"`
	ExecutedAt   time.Time `gorm:"column:executed_at;index"`
}

// CandleRecord is READ-ONLY — queried from TimescaleDB continuous aggregate views
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
	tsdb  *gorm.DB
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
// Safe to call on every startup — all statements are idempotent.
// FIX: Removed the DROP TABLE trade_records CASCADE that previously ran on every
// startup, wiping all trade data and dropping candles_1s/candles_5s views each
// time the server restarted. Replaced with CREATE TABLE IF NOT EXISTS.

func InitSchema(tsdb *gorm.DB) error {
	log.Println("[Storage] Running schema migration...")

	// 0. Enable TimescaleDB extension
	if err := tsdb.Exec(`CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE`).Error; err != nil {
		return fmt.Errorf("failed to enable timescaledb extension: %w", err)
	}

	// 1. Orders table
	if err := tsdb.AutoMigrate(&OrderRecord{}); err != nil {
		return fmt.Errorf("orders migration failed: %w", err)
	}

	// 2. Trades table — manual DDL with composite PK (id, executed_at).
	//    GORM AutoMigrate would create UNIQUE(id) alone, which TimescaleDB rejects
	//    (error TS103) because the partition column must be in every unique index.
	//    CREATE TABLE IF NOT EXISTS makes this safe to call on every restart.
	if err := tsdb.Exec(`
		CREATE TABLE IF NOT EXISTS trade_records (
			id             TEXT        NOT NULL,
			symbol         TEXT        NOT NULL,
			price          FLOAT8      NOT NULL,
			quantity       BIGINT      NOT NULL,
			maker_order_id TEXT        NOT NULL,
			taker_order_id TEXT        NOT NULL,
			executed_at    TIMESTAMPTZ NOT NULL,
			PRIMARY KEY (id, executed_at)
		)
	`).Error; err != nil {
		return fmt.Errorf("trade_records creation failed: %w", err)
	}

	// 3. Symbol index for fast per-symbol range queries
	tsdb.Exec(`
		CREATE INDEX IF NOT EXISTS idx_trade_records_symbol
		ON trade_records (symbol, executed_at DESC)
	`)

	// 4. Convert to hypertable (safe if already a hypertable)
	if err := tsdb.Exec(`
		SELECT create_hypertable('trade_records', 'executed_at',
		if_not_exists => TRUE,
		migrate_data  => TRUE)
	`).Error; err != nil {
		return fmt.Errorf("create_hypertable failed: %w", err)
	}

	// 5. 1-second candle continuous aggregate
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

	// 6. 5-second candle continuous aggregate
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

	// 7. Automatic refresh policies
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

// ---- Reset Database (For Development Only) ----

func (s *Store) ResetDatabase() error {
	log.Println("⚠️ [Storage] Wiping database clean...")

	// 1. Flush all Redis keys
	if err := s.redis.FlushDB(s.ctx).Err(); err != nil {
		return fmt.Errorf("failed to flush redis: %w", err)
	}

	// 2. Drop TimescaleDB Views & Tables
	// CASCADE is required to drop tables that have dependent materialized views
	queries := []string{
		"DROP MATERIALIZED VIEW IF EXISTS candles_1s CASCADE;",
		"DROP MATERIALIZED VIEW IF EXISTS candles_5s CASCADE;",
		"DROP TABLE IF EXISTS trade_records CASCADE;",
		"DROP TABLE IF EXISTS order_records CASCADE;",
	}

	for _, query := range queries {
		if err := s.tsdb.Exec(query).Error; err != nil {
			return fmt.Errorf("failed to drop schema: %w", err)
		}
	}

	log.Println("✅ [Storage] Database wiped successfully.")
	return nil
}

// ---- InsertOrder ----
// Stores order in Redis with a 24h TTL. CANCEL orders are skipped.

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

		if err := s.redis.Set(s.ctx, key, data, 24*time.Hour).Err(); err != nil {
			log.Printf("[Storage] InsertOrder Redis set failed for %s: %v", order.ID, err)
			return
		}

		score := float64(time.Now().UnixNano())

		s.redis.ZAdd(s.ctx, fmt.Sprintf("orders:user:%d", order.UserID), redis.Z{
			Score:  score,
			Member: order.ID,
		})

		s.redis.ZAdd(s.ctx, "orders:open:"+order.Symbol, redis.Z{
			Score:  score,
			Member: order.ID,
		})

		log.Printf("[Storage] InsertOrder stored in Redis: %s (user=%d symbol=%s)",
			order.ID, order.UserID, order.Symbol)
	}(order)
}

// ---- StartPipeline ----

func (s *Store) StartPipeline(lobStream <-chan models.LOBSnapshot) {
	go func() {
		for snap := range lobStream {
			s.handleLOBSnapshot(snap)
		}
	}()
	log.Println("[Storage] LOB snapshot pipeline started.")
}

// ---- HandleTrade ----
// Exported so main.go's trade goroutine can call it directly.
// Persists the trade to TimescaleDB and updates all Redis hot-path keys.

func (s *Store) HandleTrade(trade models.TradeMessage) {
	// 1. Persist raw trade to TimescaleDB hypertable
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

	// 2. Update fill status on Redis order JSON
	s.updateOrderStatusRedis(trade.MakerOrderID, trade.Quantity)
	s.updateOrderStatusRedis(trade.TakerOrderID, trade.Quantity)

	// 3. Update live in-progress candle in Redis
	s.updateCurrentCandle(trade)

	// 4. Append to recent trades ring buffer (last 50)
	tradeJSON, _ := json.Marshal(trade)
	key := "trades:recent:" + trade.Symbol
	s.redis.LPush(s.ctx, key, string(tradeJSON))
	s.redis.LTrim(s.ctx, key, 0, 49)
}

// updateOrderStatusRedis reads the order JSON from Redis, increments FilledQuantity,
// recalculates Status, and writes it back preserving the original TTL.
func (s *Store) updateOrderStatusRedis(orderID string, filledQty int64) {
	key := "order:" + orderID
	raw, err := s.redis.Get(s.ctx, key).Result()
	if err != nil {
		return // Order not in Redis — likely a simulation/anonymous order
	}

	var order models.Order
	if err := json.Unmarshal([]byte(raw), &order); err != nil {
		log.Printf("[Storage] updateOrderStatusRedis unmarshal failed for %s: %v", orderID, err)
		return
	}

	order.FilledQuantity += filledQty

	switch {
	case order.FilledQuantity >= order.Quantity:
		order.Status = models.StatusFilled
	case order.FilledQuantity > 0:
		order.Status = models.StatusPartial
	default:
		order.Status = models.StatusPending
	}

	data, _ := json.Marshal(order)
	s.redis.Set(s.ctx, key, data, redis.KeepTTL)
}

// ---- Redis: Current In-Progress Candle ----

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
		candle := CurrentCandle{
			Open: trade.Price, High: trade.Price,
			Low: trade.Price, Close: trade.Price,
			Volume: trade.Quantity, BucketTime: now,
		}
		data, _ := json.Marshal(candle)
		s.redis.Set(s.ctx, key, data, 0)
		return
	}

	var candle CurrentCandle
	json.Unmarshal([]byte(raw), &candle)
	channelName := "candles:" + trade.Symbol

	if !now.Equal(candle.BucketTime) {
		candle = CurrentCandle{
			Open: trade.Price, High: trade.Price,
			Low: trade.Price, Close: trade.Price,
			Volume: trade.Quantity, BucketTime: now,
		}
		data, _ := json.Marshal(candle)
		s.redis.Set(s.ctx, key, data, 0)
		s.redis.Publish(s.ctx, channelName, data)
		return
	}

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

	s.redis.Publish(s.ctx, channelName, data)
}

// ---- LOB Snapshot Handler ----

func (s *Store) handleLOBSnapshot(snap models.LOBSnapshot) {
	data, _ := json.Marshal(snap)
	key := "orderbook:" + snap.Symbol

	s.redis.Set(s.ctx, key, data, 0)
	s.redis.Publish(s.ctx, key, data)
	s.redis.Set(s.ctx, "midprice:"+snap.Symbol, fmt.Sprintf("%.4f", snap.MidPrice), 0)
}

// ---- REST API Helpers ----

func (s *Store) GetOrderBook(symbol string) (*models.LOBSnapshot, error) {
	raw, err := s.redis.Get(s.ctx, "orderbook:"+symbol).Result()
	if err != nil {
		return nil, fmt.Errorf("no order book for symbol: %s", symbol)
	}
	var snap models.LOBSnapshot
	json.Unmarshal([]byte(raw), &snap)
	return &snap, nil
}

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

func (s *Store) GetOrdersByUser(userID uint) ([]models.Order, error) {
	ids, err := s.redis.ZRevRange(s.ctx, fmt.Sprintf("orders:user:%d", userID), 0, -1).Result()
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
			continue
		}
		var o models.Order
		if err := json.Unmarshal([]byte(raw.(string)), &o); err == nil {
			orders = append(orders, o)
		}
	}
	return orders, nil
}

func (s *Store) GetOrders(userID uint, orderID string) ([]models.Order, error) {
	if orderID != "" {
		order, err := s.GetOrderByID(orderID)
		if err != nil {
			return nil, err
		}
		if userID != 0 && order.UserID != userID {
			return nil, fmt.Errorf("order %s does not belong to user %d", orderID, userID)
		}
		return []models.Order{*order}, nil
	}
	if userID != 0 {
		return s.GetOrdersByUser(userID)
	}
	return nil, fmt.Errorf("must provide at least one of userID or orderID")
}

func (s *Store) GetCurrentCandle(symbol string) (*CurrentCandle, error) {
	raw, err := s.redis.Get(s.ctx, "candle:current:"+symbol).Result()
	if err != nil {
		return nil, err
	}
	var candle CurrentCandle
	json.Unmarshal([]byte(raw), &candle)
	return &candle, nil
}

func (s *Store) GetMidPrice(symbol string) (string, error) {
	return s.redis.Get(s.ctx, "midprice:"+symbol).Result()
}

// GetTradesBySymbol queries trade_records for a given symbol from the Candlestick DB.
// Used by portfolio history — returns the N most recent trades.
func (s *Store) GetTradesBySymbol(symbol string, limit int) ([]TradeRecord, error) {
	var trades []TradeRecord
	err := s.tsdb.
		Raw(`SELECT id, symbol, price, quantity, maker_order_id, taker_order_id, executed_at
			 FROM trade_records
			 WHERE symbol = ?
			 ORDER BY executed_at DESC
			 LIMIT ?`, symbol, limit).
		Scan(&trades).Error
	return trades, err
}
