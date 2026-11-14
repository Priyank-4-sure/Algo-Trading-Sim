// src/data/mockCandleGenerator.ts
// Generates realistic mock candlestick data for charts when backend is unavailable

export interface MockCandleData {
  bucket_time: string; // ISO timestamp
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Initial price ranges for each symbol
const INITIAL_PRICES: Record<string, number> = {
  Tech: 64230.50,
  Meme: 3380.20,
  BANK: 148.45,
  AAPL: 189.45,
  TSLA: 175.22,
};

// Volatility factors per symbol
const VOLATILITY: Record<string, number> = {
  Tech: 0.002,
  Meme: 0.003,
  BANK: 0.0015,
  AAPL: 0.0018,
  TSLA: 0.0025,
};

// Track current prices and candle state per symbol+timeframe
interface CandleState {
  currentPrice: number;
  lastUpdateTime: number;
  candles: MockCandleData[];
}

const candleStates: Record<string, CandleState> = {};

function getStateKey(symbol: string, timeframe: string): string {
  return `${symbol}:${timeframe}`;
}

// Initialize candle state for a symbol if not exists
function initCandleState(symbol: string, timeframe: string) {
  const key = getStateKey(symbol, timeframe);
  if (!candleStates[key]) {
    const initialPrice = INITIAL_PRICES[symbol] || 100;
    const now = Date.now();
    const intervalMs = timeframe === '5s' ? 5000 : 1000;

    candleStates[key] = {
      currentPrice: initialPrice,
      lastUpdateTime: now - (intervalMs * 100), // Start 100 candles ago
      candles: [],
    };

    // Generate initial history
    generateInitialCandles(symbol, timeframe, 500);
  }
  return candleStates[key];
}

// Generate initial historical candles
function generateInitialCandles(symbol: string, timeframe: string, count: number): MockCandleData[] {
  const key = getStateKey(symbol, timeframe);
  const state = candleStates[key];
  const intervalMs = timeframe === '5s' ? 5000 : 1000;
  const volatility = VOLATILITY[symbol] || 0.002;

  const candles: MockCandleData[] = [];
  let price = state.currentPrice;

  for (let i = count; i > 0; i--) {
    const bucketTime = new Date(state.lastUpdateTime - (intervalMs * i));

    // Generate OHLC with realistic spreads
    const open = price;
    const change = (Math.random() - 0.5) * volatility * 2;
    const close = price * (1 + change);
    const high = Math.max(open, close) * (1 + Math.random() * volatility * 0.5);
    const low = Math.min(open, close) * (1 - Math.random() * volatility * 0.5);
    const volume = Math.floor(Math.random() * 10000) + 1000;

    candles.push({
      bucket_time: bucketTime.toISOString(),
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume,
    });

    price = close;
  }

  state.currentPrice = price;
  state.candles = candles;
  state.lastUpdateTime = state.lastUpdateTime - (intervalMs * count);

  return candles;
}

// Generate new live candle(s)
export function generateMockCandles(symbol: string, timeframe: string, count: number = 1): MockCandleData[] {
  initCandleState(symbol, timeframe);
  const state = candleStates[getStateKey(symbol, timeframe)];
  const intervalMs = timeframe === '5s' ? 5000 : 1000;
  const volatility = VOLATILITY[symbol] || 0.002;

  const candles: MockCandleData[] = [];

  for (let i = 0; i < count; i++) {
    const bucketTime = new Date(Date.now() - (intervalMs * (count - i - 1)));
    const open = state.currentPrice;
    const change = (Math.random() - 0.5) * volatility * 2;
    const close = Math.max(open * (1 + change), 0.01);
    const high = Math.max(open, close) * (1 + Math.random() * volatility * 0.5);
    const low = Math.min(open, close) * (1 - Math.random() * volatility * 0.5);
    const volume = Math.floor(Math.random() * 10000) + 1000;

    const candle: MockCandleData = {
      bucket_time: bucketTime.toISOString(),
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume,
    };

    candles.push(candle);
    state.currentPrice = close;
    state.lastUpdateTime = bucketTime.getTime();
  }

  // Keep only last 500 candles in memory
  state.candles = [...state.candles, ...candles].slice(-500);

  return candles;
}

// Get all cached candles (for initial load)
export function getCachedCandles(symbol: string, timeframe: string): MockCandleData[] {
  const key = getStateKey(symbol, timeframe);
  if (!candleStates[key]) {
    return generateMockCandles(symbol, timeframe, 500);
  }
  return candleStates[key].candles;
}

// Reset all candle states (useful when switching modes)
export function resetCandleStates() {
  Object.keys(candleStates).forEach(key => {
    delete candleStates[key];
  });
}