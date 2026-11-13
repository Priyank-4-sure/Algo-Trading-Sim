# Architecture Documentation

This document describes the system architecture, design decisions, and data flows of the Algorithmic Trading Simulator.

## Table of Contents

1. [System Overview](#system-overview)
2. [Frontend Architecture](#frontend-architecture)
3. [Backend Architecture](#backend-architecture)
4. [Order Matching Engine](#order-matching-engine)
5. [Data Flow](#data-flow)
6. [Database Design](#database-design)
7. [WebSocket Communication](#websocket-communication)
8. [Security Architecture](#security-architecture)
9. [Performance Considerations](#performance-considerations)

---

## System Overview

### Component Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                          CLIENT LAYER                               │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  React Application (React 18 + TypeScript + Tailwind CSS)    │   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌──────────────┐            │   │
│  │  │ Pages       │ │ Panels      │ │ Components   │            │   │
│  │  │ - Trade     │ │ - Chart     │ │ - TopNav     │            │   │
│  │  │ - Markets   │ │ - OrderBook │ │ - SideNav    │            │   │
│  │  │ - Portfolio │ │ - OrderForm │ │ - Forms      │            │   │
│  │  │ - History   │ │ - Balances  │ │ - Layouts    │            │   │
│  │  └─────────────┘ └─────────────┘ └──────────────┘            │   │
│  │                                                                │   │
│  │  State Management                                             │   │
│  │  - AuthContext (JWT tokens, user data)                       │   │
│  │  - Custom Hooks (useMarketPrices, usePortfolio, useTrade)   │   │
│  └──────────────────────────────────────────────────────────────┘   │
└────────────────────────────┬─────────────────────────────────────────┘
                             │
                ┌────────────┴────────────┐
                │                         │
                ▼ REST API + WebSocket    ▼
         ┌──────────────┐          ┌──────────────┐
         │ HTTP Routes  │          │ WebSocket    │
         │ (CRUD ops)   │          │ (Streaming)  │
         └──────┬───────┘          └──────┬───────┘
                │                         │
┌───────────────▼─────────────────────────▼────────────────────────────┐
│                          API LAYER (Go)                               │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │ HTTP Handlers                                                │    │
│  │ - AuthHandler (register, login, refresh)                    │    │
│  │ - OrderHandler (place, cancel, query)                       │    │
│  │ - MarketHandler (assets, candles, market data)              │    │
│  │ - PortfolioHandler (holdings, history, P&L)                 │    │
│  │ - WebSocketHandler (connection upgrade, streaming)          │    │
│  └──────────────────────────────────────────────────────────────┘    │
└────────────┬─────────────────────────────────────────────────────────┘
             │
    ┌────────▼────────┐
    │ Business Logic  │
    └────────┬────────┘
             │
┌────────────▼─────────────────────────────────────────────────────────┐
│                    CORE ENGINE LAYER (Go)                             │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │ Order Matching Engine                                        │    │
│  │ ┌─────────────────┐ ┌───────────┐ ┌──────────────────┐     │    │
│  │ │ Limit Order Book│ │ Matching  │ │ Priority Queue   │     │    │
│  │ │ - Bids Tree     │ │ Logic     │ │ - Price-Time     │     │    │
│  │ │ - Asks Tree     │ │ - Execute │ │   Priority       │     │    │
│  │ └─────────────────┘ │ - Generate│ └──────────────────┘     │    │
│  │                     │   Trades  │                          │    │
│  │ Market Simulation   └───────────┘                          │    │
│  │ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │    │
│  │ │ GBM Generator│ │ Noise Agents │ │ Synthetic    │        │    │
│  │ │ (Price Path) │ │ (Random Buy/ │ │ Participants │        │    │
│  │ │              │ │  Sell Orders)│ │              │        │    │
│  │ └──────────────┘ └──────────────┘ └──────────────┘        │    │
│  └──────────────────────────────────────────────────────────────┘    │
└────────────┬──────────────────────────────────────────────────────────┘
             │
    ┌────────▼────────┐
    │  Data Channels  │
    │  - orderStream  │
    │  - tradeStream  │
    │  - eventStream  │
    └────────┬────────┘
             │
┌────────────▼─────────────────────────────────────────────────────────┐
│                    DATA PERSISTENCE LAYER                             │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                 │
│  │ PostgreSQL   │ │ TimescaleDB  │ │ Redis        │                 │
│  │ (Primary DB) │ │ (Time-Series)│ │ (Cache)      │                 │
│  │              │ │              │ │              │                 │
│  │ - Users      │ │ - Candles    │ │ - Sessions   │                 │
│  │ - Orders     │ │ - Tickers    │ │ - Price      │                 │
│  │ - Trades     │ │ - Market     │ │   Cache      │                 │
│  │ - Portfolios │ │   Events     │ │ - Order      │                 │
│  │ - Watchlists │ │              │ │   Book       │                 │
│  └──────────────┘ └──────────────┘ └──────────────┘                 │
└───────────────────────────────────────────────────────────────────────┘
```

---

## Frontend Architecture

### State Management Strategy

The frontend uses a **hybrid state management** approach:

1. **Context API** for global state
   - Authentication (tokens, user info)
   - Dashboard context (active symbol, holdings)

2. **Local Component State** for UI state
   - Form inputs, modals, tabs
   - Chart zoom levels, timeframes

3. **Custom Hooks** for data fetching
   - Encapsulate API calls and WebSocket subscriptions
   - Provide clean data interface to components

### Component Hierarchy

```
App
├── LandingPage (public)
├── LoginPage (public)
├── SignUpPage (public)
└── Layout (protected)
    ├── TopNav
    │   ├── Symbol Search
    │   ├── Watchlist Dropdown
    │   └── User Menu
    ├── SideNav
    │   ├── Navigation Links
    │   └── Theme Toggle
    └── Outlet (Routes)
        ├── TradePage
        │   ├── ChartPanel
        │   ├── OrderBook
        │   ├── OrderForm
        │   └── Balances
        ├── MarketsPage
        │   └── Asset List
        ├── WatchlistPage
        │   └── Watchlist Items
        ├── AnalyticsPage
        │   └── Analytics Charts
        ├── PortfolioPage
        │   └── Holdings & P&L
        └── HistoryPage
            └── Trade History
```

### Data Flow: User Action to UI Update

```
User Action (e.g., place order)
    ↓
OrderForm Component
    ↓
useTrade Hook
    ↓
API Call: POST /orders/
    ↓
Backend Processes Order
    ↓
WebSocket: Trade Message
    ↓
usePortfolio Hook (listening)
    ↓
Portfolio State Updated
    ↓
UI Re-renders with new Holdings
```

### Key Custom Hooks

| Hook | Purpose | Data Source |
|------|---------|-------------|
| `useAuth()` | Authentication state, login/logout | LocalStorage + API |
| `useMarketPrices()` | Real-time price updates | WebSocket |
| `usePortfolio()` | Holdings and P&L tracking | WebSocket |
| `useTrade()` | Order placement and cancellation | REST API |
| `useOrderBook()` | Order book depth data | REST API |
| `useWatchlistData()` | Watchlist management | REST API |

---

## Backend Architecture

### Layered Architecture

```
┌─────────────────────────────────────┐
│       HTTP Route Handlers           │
│  (auth.go, orders.go, market.go)    │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│     Business Logic / Services       │
│  (Order processing, Portfolio calc) │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│   Order Matching Engine + Market    │
│   Simulation (Core Algorithm)       │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│   Storage & Database Layer          │
│  (PostgreSQL, TimescaleDB, Redis)   │
└─────────────────────────────────────┘
```

### Main Components

#### 1. **Router** (`internal/api/router.go`)
- Defines all HTTP routes
- Mounts handlers with middleware
- Handles CORS and request logging

#### 2. **Handlers** (`internal/handlers/`)

Each handler processes a specific domain:

- **AuthHandler**: JWT token issuance/refresh
- **OrderHandler**: Order CRUD operations
- **MarketHandler**: Asset and candle data
- **PortfolioHandler**: Holdings and P&L queries
- **WebSocketHandler**: Upgrade HTTP to WebSocket

#### 3. **Matching Engine** (`internal/matching/`)

The core order processing system:

```go
type Engine struct {
    Books      map[string]*OrderBook      // Limit order books per symbol
    OrderIndex map[string]*OrderNode      // Quick order lookup
    OrderStream <-chan models.Order       // Incoming orders
    TradeStream chan<- models.TradeMessage // Executed trades
}
```

**Processing Flow:**
1. Order arrives via `OrderStream` channel
2. Engine looks up or creates limit order book
3. Matches against existing orders (best price first)
4. Generates trade messages for matched orders
5. Remaining unmatched order stays in book

#### 4. **Market Simulation** (`internal/simulation/`)

Generates realistic market conditions:

- **GBM (Geometric Brownian Motion)**: Generates price paths
- **Noise Agents**: Create random order flow
- **Synthetic Participants**: Execute algorithmic strategies

---

## Order Matching Engine

### Algorithm: Price-Time Priority

The matching engine implements the **Price-Time** (also called "FIFO at price level") algorithm:

```
Incoming BUY Order: 100 shares @ $50
│
├─► Check ASK side for sells at ≤$50
│   │
│   ├─► ASK Level 1: $50 (50 shares, T=100ms) ──► MATCH 50 shares
│   │
│   ├─► ASK Level 1: $50 (30 shares, T=150ms) ──► MATCH 30 shares
│   │
│   └─► ASK Level 2: $51 ──► No match
│
├─► Unmatched: 20 shares
│
└─► Add to BID book at $50 (T=now)
```

### Order Book Structure

```go
type OrderSide struct {
    Levels map[float64]*OrderNode  // Price level → First order
    // Each OrderNode points to next node at same price (queue)
}

type OrderNode struct {
    Order *models.Order
    Next  *OrderNode  // Next order at same price level
    Prev  *OrderNode
}
```

**Why this structure:**
- O(log n) insertion/deletion via tree traversal
- O(1) price-time matching at each level
- Preserves order arrival sequence at each price

### Execution Example

```
Initial State:
BID: [50@T0, 50@T1] | ASK: [51@T2, 52@T3]

Incoming: BUY 100 @ 51
  1. Matches 100 units from ASK[51@T2] ✓
  2. No more ASK orders below market
  3. Returns: Trade(+100 units, -$5100)

Result:
BID: [50@T0, 50@T1] | ASK: [52@T3]
```

---

## Data Flow

### 1. Order Entry Flow

```
User Submit Order
    ↓
OrderForm.tsx validates
    ↓
POST /v1/orders/ (REST)
    ↓
AuthMiddleware (verify JWT)
    ↓
OrderHandler (parse request)
    ↓
Enqueue to orderStream (buffered channel, cap=100k)
    ↓
Matching Engine (background goroutine)
    ├─► Match against LOB
    ├─► Generate TradeMessage
    └─► Enqueue to tradeStream
    ↓
Trade Logger (background goroutine)
    ├─► Persist to database
    └─► Update portfolio
    ↓
WebSocket Broadcaster
    └─► Send trade + portfolio update to client
```

### 2. Real-Time Price Update Flow

```
Market Simulation (background)
    ├─► GBM: Generate new price
    └─► Enqueue to eventStream
    ↓
WebSocket Handler (listening)
    ├─► Format price data
    └─► Broadcast to all connected clients
    ↓
useMarketPrices Hook (React)
    ├─► Receive price update
    ├─► Update local state
    └─► Re-render chart
```

### 3. Portfolio Update Flow

```
Trade Executed
    ↓
tradeStream receives TradeMessage
    ↓
Portfolio Calculator
    ├─► Update holdings (shares + cost basis)
    ├─► Calculate new P&L
    └─► Calculate returns %
    ↓
WebSocket Message: PortfolioUpdate
    ↓
usePortfolio Hook (React)
    ├─► Received via WebSocket
    ├─► Update local holdings state
    └─► UI reflects new portfolio
```

---

## Database Design

### Schema Overview

#### PostgreSQL (Primary Database)

**Users Table**
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255),
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
```

**Orders Table**
```sql
CREATE TABLE orders (
    id VARCHAR(255) PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    symbol VARCHAR(10) NOT NULL,
    side VARCHAR(4) NOT NULL,  -- BUY or SELL
    quantity DECIMAL(15,8) NOT NULL,
    price DECIMAL(15,8),  -- NULL for market orders
    status VARCHAR(20) NOT NULL,  -- PENDING, MATCHED, CANCELLED
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

**Trades Table**
```sql
CREATE TABLE trades (
    id VARCHAR(255) PRIMARY KEY,
    buy_order_id VARCHAR(255) REFERENCES orders(id),
    sell_order_id VARCHAR(255) REFERENCES orders(id),
    symbol VARCHAR(10) NOT NULL,
    quantity DECIMAL(15,8) NOT NULL,
    price DECIMAL(15,8) NOT NULL,
    executed_at TIMESTAMP DEFAULT NOW()
);
```

**Portfolios Table**
```sql
CREATE TABLE portfolios (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
    cash_balance DECIMAL(15,8) NOT NULL,
    equity_value DECIMAL(15,8) NOT NULL,
    total_value DECIMAL(15,8) NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW()
);
```

**Holdings Table**
```sql
CREATE TABLE holdings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    symbol VARCHAR(10) NOT NULL,
    quantity DECIMAL(15,8) NOT NULL,
    cost_basis DECIMAL(15,8) NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, symbol)
);
```

#### TimescaleDB (Time-Series Data)

**Candles Table** (Hypertable)
```sql
CREATE TABLE candles (
    time TIMESTAMP NOT NULL,
    symbol VARCHAR(10) NOT NULL,
    interval VARCHAR(10) NOT NULL,  -- '1m', '5m', '1h', etc.
    open DECIMAL(15,8) NOT NULL,
    high DECIMAL(15,8) NOT NULL,
    low DECIMAL(15,8) NOT NULL,
    close DECIMAL(15,8) NOT NULL,
    volume DECIMAL(15,8) NOT NULL
);

SELECT create_hypertable('candles', 'time', if_not_exists => TRUE);
CREATE INDEX ON candles (symbol, interval, time DESC);
```

**Market Events Table** (Hypertable)
```sql
CREATE TABLE market_events (
    time TIMESTAMP NOT NULL,
    symbol VARCHAR(10) NOT NULL,
    event_type VARCHAR(50) NOT NULL,  -- 'PRICE_UPDATE', 'TRADE', etc.
    data JSONB
);
```

#### Redis (Cache)

Key patterns:
```
price:{symbol}           → Current price (string)
book:{symbol}:bids       → Bid side orders (sorted set)
book:{symbol}:asks       → Ask side orders (sorted set)
session:{token}          → User session data (hash)
portfolio:{user_id}      → Holdings snapshot (hash)
```

---

## WebSocket Communication

### Connection Lifecycle

```
1. Client initiates WebSocket upgrade
   GET /v1/ws
   ↓
2. Server accepts and creates connection
   ↓
3. Client sends subscribe message (optional)
   {"type": "SUBSCRIBE", "symbols": ["AAPL", "GOOGL"]}
   ↓
4. Server maintains connection and streams updates
   ↓
5. Server broadcasts on trade/price changes
   {"type": "PRICE_UPDATE", "symbol": "AAPL", "price": 150.50}
   ↓
6. Client disconnects or server closes
```

### Message Format

**Incoming (Client → Server)**
```json
{
  "type": "SUBSCRIBE",
  "symbols": ["AAPL", "GOOGL", "MSFT"]
}
```

**Outgoing (Server → Client)**
```json
{
  "type": "PRICE_UPDATE",
  "symbol": "AAPL",
  "price": 150.50,
  "change_24h": 2.5,
  "timestamp": 1698569238
}
```

```json
{
  "type": "PORTFOLIO_UPDATE",
  "holdings": [
    {"symbol": "AAPL", "quantity": 100, "value": 15050},
    {"symbol": "CASH", "quantity": 50000, "value": 50000}
  ],
  "total_value": 65050,
  "timestamp": 1698569238
}
```

### Broadcast Pattern

```
Order Matched
    ↓
tradeStream channel receives trade
    ↓
Background Worker goroutine
    ├─► Persist to database
    ├─► Update portfolio
    ├─► Create notification
    └─► Enqueue to broadcast channel
    ↓
WebSocket Hub (maintains client connections)
    └─► Send to all connected clients
```

---

## Security Architecture

### Authentication Flow

```
1. User Registration
   POST /auth/register
   Body: {email, password, fullName}
   ├─► Hash password (bcrypt)
   ├─► Store in database
   └─► Return tokens

2. User Login
   POST /auth/login
   Body: {email, password}
   ├─► Verify password hash
   ├─► Generate JWT tokens (access + refresh)
   └─► Return tokens

3. Token Validation
   All protected endpoints:
   ├─► Extract JWT from Authorization header
   ├─► Verify signature and expiration
   ├─► Extract user ID from claims
   └─► Proceed or return 401
```

### JWT Token Structure

```
Access Token (short-lived, ~15 mins)
├─► iss: issuer
├─► sub: user_id
├─► iat: issued at
├─► exp: expiration
└─► Signed with SERVER_JWT_SECRET

Refresh Token (long-lived, ~7 days)
├─► sub: user_id
├─► iat: issued at
├─► exp: expiration
└─► Signed with SERVER_JWT_REFRESH_SECRET
```

### Authorization Checks

```
// Before processing order
func OrderHandler(w http.ResponseWriter, r *http.Request) {
    // 1. Verify JWT token
    claims := r.Context().Value("claims").(jwt.Claims)
    userID := claims.Subject
    
    // 2. Verify user owns the order (if cancelling)
    order, err := db.GetOrder(orderID)
    if order.UserID != userID {
        return 403 Forbidden  // User can't cancel another's order
    }
    
    // 3. Process request
}
```

### Security Best Practices

1. **Password Hashing**: bcrypt with salt
2. **JWT Secrets**: Environment variables, never hardcoded
3. **HTTPS Only**: Tokens sent only over encrypted connections
4. **Token Rotation**: Refresh tokens used to get new access tokens
5. **CORS**: Restricted to allowed origins
6. **Rate Limiting**: Prevent brute force attacks (per implementation)
7. **Input Validation**: All API inputs validated before processing

---

## Performance Considerations

### Order Matching Latency

**Optimizations:**
1. **In-Memory LOB**: No database queries during matching
2. **Channel-Based**: Goroutine processes orders sequentially
3. **Efficient Data Structure**: Red-Black tree for price levels (O(log n))
4. **Batch Processing**: Group trades for bulk database writes

**Typical Latencies:**
- Simple order match: 1-2ms
- Database persistence: 2-3ms
- WebSocket broadcast: <1ms
- **Total end-to-end**: 4-5ms (p95)

### Concurrent Users

**Scaling strategies:**
1. **Order Stream Buffer**: Cap of 100k prevents memory explosion
2. **Trade Stream Buffer**: Cap of 10k prevents log backlog
3. **Redis Caching**: Reduces database load for frequently accessed data
4. **Horizontal Scaling**: Multiple backend instances (with shared DB)

**Capacity:**
- Single instance: ~1000 concurrent WebSocket connections
- Order throughput: 10k-50k orders/sec (limited by database I/O)

### Database Performance

**Query Optimization:**
1. **Indexing**: Composite indexes on (user_id, created_at) for history
2. **Partitioning**: TimescaleDB time-partitions candles by day
3. **Caching**: Redis for hot data (current prices, recent trades)
4. **Batch Writes**: Accumulate trades before bulk insert

**Expected Query Times:**
- Recent order history (10 items): <50ms
- Portfolio calculation: <100ms
- Candle lookup (500 candles): <100ms

### Frontend Performance

**Optimizations:**
1. **Code Splitting**: Lazy load pages via React Router
2. **Memoization**: useMemo for expensive calculations
3. **Virtual Lists**: Don't render 10k trades at once
4. **WebSocket**: Efficient streaming instead of polling
5. **Tailwind**: Tree-shaking removes unused CSS

**Metrics:**
- Initial load: ~2-3s (with lazy loading)
- Page navigation: <500ms
- Chart rendering: 60fps (with 1000+ candles)

---

## Deployment Architecture

### Docker Compose Stack

```yaml
Services:
├── client (React/Nginx)      # Port 80
├── server (Go/API)           # Port 8080
├── postgres-primary          # Internal only
├── timescaledb              # Internal only
└── redis                    # Internal only
```

**Network:**
- Services communicate internally via service names
- Only client (80) and server (8080) exposed to host
- Databases remain internal for security

### Environment-Specific Config

```
Development (.env):
├─ localhost URLs
├─ Debug logging enabled
└─ No rate limiting

Production (.env):
├─ Domain URLs
├─ Info logging only
├─ Rate limiting enabled
└─ HTTPS enforced
```

---

## Future Architecture Considerations

### Scalability Roadmap

1. **Microservices** (if needed)
   - Separate matching engine from API layer
   - Independent scaling per service

2. **Event Sourcing**
   - Log all trades and portfolio changes
   - Rebuild state from events if needed

3. **CQRS Pattern**
   - Separate read models for analytics
   - Separate write model for order matching

4. **Cache Layer**
   - Redis cluster for distributed caching
   - Cache warming for common queries

### High Availability

1. **Load Balancing**
   - Multiple API instances behind load balancer
   - Sticky sessions for WebSocket connections

2. **Database Replication**
   - PostgreSQL streaming replication
   - TimescaleDB replicas for read queries

3. **Circuit Breakers**
   - Graceful degradation if database unavailable
   - Fallback to cache data

---

## Monitoring & Observability

### Key Metrics

**Order Matching:**
- Orders/sec (throughput)
- Match latency (p50, p95, p99)
- Order book depth per symbol

**WebSocket:**
- Active connections
- Messages/sec sent
- Broadcast latency

**Database:**
- Query latency (by type)
- Connection pool utilization
- Slow query log

**Frontend:**
- Page load time
- Interactive time
- Web Vitals (LCP, FID, CLS)

### Logging Strategy

```
Backend:
- ERROR: Problems that need attention
- INFO: Key business events (orders, trades)
- DEBUG: Detailed execution flow (dev only)

Frontend:
- ERROR: Console errors, unhandled rejections
- WARN: API failures, validation issues
- INFO: User actions, navigation
```

---

## References

- **Order Book Implementation**: Based on exchange-grade LOB design
- **GBM**: Standard quantitative finance model for price simulation
- **Concurrency**: Go channels for safe goroutine communication
- **Frontend State**: React hooks and context for simplicity over Redux
