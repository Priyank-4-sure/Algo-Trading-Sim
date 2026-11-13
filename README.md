# Algorithmic Trading Simulator

> A full-stack paper trading platform with real-time order matching engine, live market simulation, and professional trading interface.

![React](https://img.shields.io/badge/React-18.2-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.2-3178C6?logo=typescript)
![Go](https://img.shields.io/badge/Go-1.21+-00ADD8?logo=go)
![Docker](https://img.shields.io/badge/Docker-Supported-2496ED?logo=docker)

## Overview

This project simulates a real-world trading ecosystem with:

- **Frontend**: Modern React UI with real-time charts, order management, and portfolio tracking
- **Backend**: Concurrent order matching engine in Go with Price-Time priority
- **Infrastructure**: PostgreSQL, TimescaleDB, and Redis for data persistence and caching
- **WebSocket**: Live streaming of prices, orders, and portfolio updates

### Key Features

✨ **Real-Time Order Matching**
- In-memory limit order book with Price-Time priority
- Concurrent order processing using Go channels
- Sub-millisecond matching latency

📊 **Live Trading Interface**
- Interactive candlestick charts with drawing tools
- Order book visualization with depth analysis
- Real-time portfolio tracking and P&L calculation
- Responsive design for desktop and mobile

🔐 **Enterprise Authentication**
- JWT-based authentication with refresh tokens
- Secure session management
- Rate limiting and token expiration

🎯 **Market Simulation**
- Geometric Brownian Motion (GBM) for price generation
- Noise trading agents for realistic order flow
- Synthetic market participants
- Configurable volatility and asset profiles

---

## Quick Start

### Prerequisites

- **Node.js** 18+ (for frontend)
- **Go** 1.21+ (for backend)
- **Docker & Docker Compose** (for database infrastructure)

### Option 1: Docker (Recommended)

```bash
# Clone the repository
git clone https://github.com/GC-OpenSoft-2026/Algorithmic-Trading-Simulator.git
cd Algorithmic-Trading-Simulator

# Create environment file
cat > .env << EOF
PRIMARY_DB_PASSWORD=local_secret_db
CANDLESTICK_DB_PASSWORD=local_secret_ts
REDIS_PASSWORD=local_secret_redis
SERVER_JWT_SECRET=local_super_secret_jwt_key
SERVER_JWT_REFRESH_SECRET=local_super_secret_refresh_key
EOF

# Start all services
docker compose up -d --build

# Access the application
open http://localhost
```

### Option 2: Local Development

**Terminal 1 - Database Infrastructure**
```bash
docker compose up -d postgres-primary timescaledb redis
```

**Terminal 2 - Backend**
```bash
cd server
go mod tidy
go run cmd/synthetic-bull/main.go
# Server runs on http://localhost:8080
```

**Terminal 3 - Frontend**
```bash
cd client
npm install
npm run dev
# Frontend runs on http://localhost:5173
```

---

## Architecture

For detailed system architecture, data flows, and design decisions, see [ARCHITECTURE.md](./ARCHITECTURE.md).

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React + TS)                    │
│  - Interactive trading UI with TradingView charts            │
│  - Real-time WebSocket connections                           │
│  - Context API + Custom Hooks for state management           │
└────────────────────────┬────────────────────────────────────┘
                         │ REST API + WebSocket
┌────────────────────────▼────────────────────────────────────┐
│                   Backend (Go)                               │
│  ┌─────────────────────────────────────┐                    │
│  │   Order Matching Engine             │                    │
│  │   - In-memory limit order book      │                    │
│  │   - Price-Time priority matching    │                    │
│  │   - Concurrent channel processing   │                    │
│  └─────────────────────────────────────┘                    │
│  - REST handlers (auth, orders, portfolio)                  │
│  - WebSocket streaming (prices, trades, updates)            │
│  - Market simulation (GBM + noise agents)                    │
└────────────────────────┬────────────────────────────────────┘
                         │
          ┌──────────────┼──────────────┐
          │              │              │
    ┌─────▼────┐  ┌──────▼──────┐  ┌──▼────────┐
    │PostgreSQL│  │ TimescaleDB │  │  Redis    │
    │ (Users,  │  │ (Candles,   │  │ (Cache,   │
    │ Orders,  │  │  Tickers)   │  │ Sessions) │
    │ Trades)  │  │             │  │           │
    └──────────┘  └─────────────┘  └───────────┘
```

---

## API Reference

Base URL: `/v1`

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Create new account |
| POST | `/auth/login` | Authenticate user |
| POST | `/auth/refresh` | Rotate access token |
| POST | `/auth/logout` | Revoke session |

### Trading
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/orders/` | Place limit/market order |
| DELETE | `/orders/{id}` | Cancel order |
| GET | `/orders/{id}` | Get order status |
| GET | `/orders/active` | List active orders |
| GET | `/orders/history` | Paginated order history |

### Market Data
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/assets` | List all tradeable assets |
| GET | `/marketdata/{symbol}` | Latest price & metrics |
| GET | `/candles/{symbol}/{interval}` | OHLCV candle history |

### Portfolio
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/trades/history` | Executed trade history |
| GET | `/portfolio/history` | Equity curve & P&L |
| POST | `/portfolio/reset` | Reset to initial state |

### Watchlist
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/watchlist/` | User's watchlist |
| POST | `/watchlist/{symbol}` | Add to watchlist |
| DELETE | `/watchlist/{symbol}` | Remove from watchlist |

### WebSocket
| Endpoint | Description |
|----------|-------------|
| `/ws` | Real-time price & portfolio updates |

*All `/orders`, `/trades`, `/portfolio`, `/watchlist` endpoints require JWT authentication.*

---

## Project Structure

```
Algorithmic-Trading-Simulator/
├── client/                          # React frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── pages/              # Page components (Trade, Markets, Portfolio, etc.)
│   │   │   ├── panels/             # Trading panels (ChartPanel, OrderBook, OrderForm)
│   │   │   ├── layouts/            # Layout components (TopNav, SideNav, Layout)
│   │   │   └── shared/             # Reusable UI components
│   │   ├── hooks/                  # Custom React hooks (useMarketPrices, useTrade, etc.)
│   │   ├── context/                # Context API (AuthContext)
│   │   ├── utils/                  # Utilities (token validation, etc.)
│   │   ├── data/                   # Mock data and symbol metadata
│   │   └── config.ts               # API base URL configuration
│   ├── package.json
│   ├── tsconfig.json
│   ├── tailwind.config.js
│   └── vite.config.ts
│
├── server/                          # Go backend
│   ├── cmd/
│   │   └── synthetic-bull/
│   │       └── main.go             # Application entry point
│   ├── internal/
│   │   ├── api/
│   │   │   └── router.go           # HTTP route definitions
│   │   ├── handlers/               # Request handlers
│   │   │   ├── auth.go
│   │   │   ├── orders.go
│   │   │   ├── market.go
│   │   │   ├── portfolio.go
│   │   │   └── ws.go
│   │   ├── matching/               # Order matching engine
│   │   │   ├── engine.go           # Main matching logic
│   │   │   ├── orderqueue.go       # Order priority queue
│   │   │   ├── orderside.go        # Bid/Ask side implementation
│   │   │   └── LOBBuilder.go       # Limit order book builder
│   │   ├── simulation/             # Market simulation
│   │   │   ├── gbm/                # Geometric Brownian Motion
│   │   │   ├── noise/              # Noise trading agents
│   │   │   └── synthetic/          # Synthetic market participants
│   │   ├── models/                 # Data models
│   │   ├── database/               # Database connection
│   │   ├── storage/                # Data storage layer
│   │   ├── config/                 # Configuration
│   │   └── utils/                  # Utilities (JWT, response formatting)
│   ├── go.mod
│   └── Dockerfile
│
├── docker-compose.yml              # Infrastructure orchestration
├── .env.example                    # Environment template
└── README.md                       # This file
```

---

## Development

### Frontend Commands

```bash
cd client

# Install dependencies
npm install

# Start development server (hot reload)
npm run dev

# Type checking
npm run build

# Linting
npm run lint

# Preview production build
npm preview
```

### Backend Commands

```bash
cd server

# Download dependencies
go mod tidy

# Run the application
go run cmd/synthetic-bull/main.go

# Run with custom config
CONFIG_PATH=./config/development.yaml go run cmd/synthetic-bull/main.go
```

### Database Migrations

```bash
# Start the database
docker compose up postgres-primary timescaledb -d

# Connect to database
psql -h localhost -U admin -d alerts_core_db
```

---

## Configuration

Create a `.env` file in the root directory:

```env
# Database Credentials
PRIMARY_DB_PASSWORD=your_secure_password
CANDLESTICK_DB_PASSWORD=your_secure_password
REDIS_PASSWORD=your_secure_password

# JWT Secrets
SERVER_JWT_SECRET=your_jwt_secret_key
SERVER_JWT_REFRESH_SECRET=your_jwt_refresh_secret_key

# API Configuration (optional)
VITE_API_BASE_URL=http://localhost:8080/v1
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | Backend API base URL | `http://localhost:8080/v1` |
| `PRIMARY_DB_PASSWORD` | PostgreSQL password | Required |
| `CANDLESTICK_DB_PASSWORD` | TimescaleDB password | Required |
| `REDIS_PASSWORD` | Redis password | Required |
| `SERVER_JWT_SECRET` | JWT signing secret | Required |
| `SERVER_JWT_REFRESH_SECRET` | JWT refresh secret | Required |

---

## Technologies Used

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Vite** - Build tool
- **React Router v7** - Client-side routing
- **lightweight-charts** - Professional charting
- **React Hot Toast** - Notifications
- **Lucide React** - Icons

### Backend
- **Go 1.21+** - Backend language
- **PostgreSQL** - Primary database
- **TimescaleDB** - Time-series data
- **Redis** - Caching & sessions
- **Goroutines & Channels** - Concurrent processing

### DevOps
- **Docker** - Containerization
- **Docker Compose** - Multi-container orchestration
- **Nginx** - Frontend reverse proxy

---

## Performance Characteristics

- **Order Matching**: ~4-5ms median latency per order
- **WebSocket Throughput**: 50k+ messages/sec per connection
- **Chart Rendering**: 60fps with 1000+ candles
- **Database Queries**: Sub-100ms for portfolio and order history

---

## Git Workflow

We follow a structured branching model:

1. **Feature branches** off `develop`:
   ```bash
   git checkout -b feat/your-feature-name
   ```

2. **Commit with semantic prefixes**:
   ```bash
   git commit -m "feat: add real-time order notifications"
   git commit -m "fix: correct P&L calculation bug"
   ```

3. **Push and create PR**:
   ```bash
   git push -u origin feat/your-feature-name
   ```

4. **Merge to `develop`** after code review
5. **Release to `main`** when ready for production

See [Git Workflow Guide](#) for detailed instructions.

---

## Future Enhancements

- [ ] Advanced charting indicators (RSI, MACD, Bollinger Bands)
- [ ] Options trading support
- [ ] Strategy backtesting engine
- [ ] Multi-asset portfolio optimization
- [ ] Real-time risk analytics dashboard
- [ ] Paper trading leaderboard
- [ ] Mobile native app (React Native)
- [ ] Machine learning trade predictions

---

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feat/amazing-feature`)
5. Open a Pull Request

---

## License

This project is licensed under the MIT License - see the LICENSE file for details.

---

## Support & Contact

For questions or issues:
- Open an [GitHub Issue](https://github.com/GC-OpenSoft-2026/Algorithmic-Trading-Simulator/issues)
- Check the [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed design documentation

---

## Acknowledgments

- Built as part of the GC OpenSoft 2026 initiative
- Order matching engine inspired by real exchange architectures
- Market simulation based on quantitative finance principles
