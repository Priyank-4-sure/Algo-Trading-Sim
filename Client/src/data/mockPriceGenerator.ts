// src/data/mockPriceGenerator.ts
// Generates evolving mock market prices with realistic random walks
// When backend is unavailable, this provides persistent fake data
// Prices persist across page refreshes via localStorage

import {
  retrieveMockPrices,
  storeMockPrices,
  clearMockPrices,
  storeTickHistory,
  retrieveTickHistory,
  getTickMetadata,
  updateTickMetadata,
  storeOrderbook,
  TickData,
  OrderbookLevel,
} from "./mockStorage";

export interface MockPriceData {
  symbol: string;
  price: number;
  change_24h: number;
  high_24h: number;
  low_24h: number;
  volume_24h: number;
  sparkline: number[];
}

export interface MockCandleData {
  bucket_time: string; // ISO timestamp
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface OrderbookData {
  symbol: string;
  timestamp: number;
  bids: OrderbookLevel[];
  asks: OrderbookLevel[];
  spread: number;
  midPrice: number;
}

// Initial price ranges for each symbol (based on the mock market data)
const INITIAL_PRICES: Record<string, number> = {
  Tech: 64230.50,
  Meme: 3380.20,
  BANK: 148.45,
  AAPL: 189.45,
  TSLA: 175.22,
};

// Volatility factors per symbol (controls how much prices move)
const VOLATILITY: Record<string, number> = {
  Tech: 0.02,
  Meme: 0.03,
  BANK: 0.015,
  AAPL: 0.018,
  TSLA: 0.025,
};

// Bid-ask spreads per symbol (in percentage)
const SPREADS: Record<string, number> = {
  Tech: 0.008,  // 0.8% spread
  Meme: 0.015,  // 1.5% spread (more volatile)
  BANK: 0.005,  // 0.5% spread (stable)
  AAPL: 0.006,  // 0.6% spread
  TSLA: 0.01,   // 1% spread
};

// 24h change range per symbol
const CHANGE_24H_RANGE: Record<string, [number, number]> = {
  Tech: [-3, 3],
  Meme: [-4, 4],
  BANK: [-2, 2],
  AAPL: [-2, 2],
  TSLA: [-3, 3],
};

// Track current prices so they evolve persistently
// Initialize from stored data or initial values
let currentMockPrices: Record<string, number> = {};
let isInitialized = false;

// Initialize from localStorage on module load for persistence across refreshes
function initializeFromStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    const storedPrices = retrieveMockPrices();
    if (storedPrices && storedPrices.length > 0 && !isInitialized) {
      for (const stored of storedPrices) {
        if (!(stored.symbol in currentMockPrices)) {
          currentMockPrices[stored.symbol] = stored.price;
        }
      }
      isInitialized = true;
    }
  } catch (e) {
    console.error('Failed to initialize from storage:', e);
  }
}

// Run initialization on module load (only in browser)
initializeFromStorage();

// Subscribers for price updates
const priceSubscribers: Map<string, Set<(price: number) => void>> = new Map();

// Get the current price for a symbol without generating a new tick
export function getCurrentMockPrice(symbol: string): number {
  if (!(symbol in currentMockPrices)) {
    // Initialize if needed
    initMockPrices([symbol]);
  }
  return currentMockPrices[symbol];
}

// Subscribe to price updates
export function subscribeToPrice(symbol: string, callback: (price: number) => void): () => void {
  if (!priceSubscribers.has(symbol)) {
    priceSubscribers.set(symbol, new Set());
  }
  priceSubscribers.get(symbol)!.add(callback);
  // Return unsubscribe function
  return () => {
    priceSubscribers.get(symbol)?.delete(callback);
  };
}

// Notify subscribers of price change
function notifyPriceChange(symbol: string, price: number): void {
  priceSubscribers.get(symbol)?.forEach(cb => cb(price));
}

// ========== ORDERBOOK GENERATION ==========

export function generateOrderbook(symbol: string): OrderbookData {
  const currentPrice = getCurrentMockPrice(symbol);
  const spread = SPREADS[symbol] || 0.01;
  const spreadAmount = currentPrice * spread;
  const bidPrice = currentPrice - spreadAmount / 2;
  const askPrice = currentPrice + spreadAmount / 2;

  // Generate 15 levels on each side
  const bids: OrderbookLevel[] = [];
  const asks: OrderbookLevel[] = [];

  for (let i = 0; i < 15; i++) {
    // Bids: decrease in price as we go down, decrease in quantity
    const bidLevelPrice = bidPrice - (i * spreadAmount * 0.5);
    const bidQuantity = Math.floor(Math.random() * 1000 + 100) / (1 + i * 0.1);
    bids.push({
      price: Math.round(bidLevelPrice * 100) / 100,
      quantity: Math.round(bidQuantity * 100) / 100,
    });

    // Asks: increase in price as we go up, decrease in quantity
    const askLevelPrice = askPrice + (i * spreadAmount * 0.5);
    const askQuantity = Math.floor(Math.random() * 1000 + 100) / (1 + i * 0.1);
    asks.push({
      price: Math.round(askLevelPrice * 100) / 100,
      quantity: Math.round(askQuantity * 100) / 100,
    });
  }

  const orderbook: OrderbookData = {
    symbol,
    timestamp: Date.now(),
    bids: bids.sort((a, b) => b.price - a.price), // High to low
    asks: asks.sort((a, b) => a.price - b.price), // Low to high
    spread: Math.round(spread * 10000) / 100, // Convert to basis points
    midPrice: currentPrice,
  };

  // Persist to storage
  storeOrderbook({
    symbol,
    timestamp: orderbook.timestamp,
    bids: orderbook.bids,
    asks: orderbook.asks,
    spread: orderbook.spread,
    midPrice: orderbook.midPrice,
  });

  return orderbook;
}

// Subscribers for orderbook updates
const orderbookSubscribers: Map<string, Set<(ob: OrderbookData) => void>> = new Map();

export function subscribeToOrderbook(symbol: string, callback: (ob: OrderbookData) => void): () => void {
  if (!orderbookSubscribers.has(symbol)) {
    orderbookSubscribers.set(symbol, new Set());
  }
  orderbookSubscribers.get(symbol)!.add(callback);
  return () => {
    orderbookSubscribers.get(symbol)?.delete(callback);
  };
}

// ========== ORDERBOOK GENERATION ==========

export function initMockPrices(symbols: string[]) {
  if (isInitialized) return;

  // First, try to retrieve stored prices from localStorage
  const storedPrices = retrieveMockPrices();

  for (const symbol of symbols) {
    if (!(symbol in currentMockPrices)) {
      // Use stored price if available, otherwise use initial price
      const stored = storedPrices.find((p: { symbol: string; price: number }) => p.symbol === symbol);
      if (stored) {
        currentMockPrices[symbol] = stored.price;
      } else {
        currentMockPrices[symbol] = INITIAL_PRICES[symbol] || 100;
      }
    }
  }
  isInitialized = true;
}

// Generate a single price tick with random walk
export function generateMockTick(symbol: string): MockPriceData {
  // Ensure prices are initialized
  if (!(symbol in currentMockPrices)) {
    currentMockPrices[symbol] = INITIAL_PRICES[symbol] || 100;
  }

  const volatility = VOLATILITY[symbol] || 0.02;
  const [minChange, maxChange] = CHANGE_24H_RANGE[symbol] || [-3, 3];

  // Random walk: small random change
  const changePercent = (Math.random() * (maxChange - minChange) + minChange) / 100;
  const newPrice = currentMockPrices[symbol] * (1 + changePercent);

  // Clamp to reasonable positive values
  currentMockPrices[symbol] = Math.max(newPrice, 0.01);

  // Notify subscribers
  notifyPriceChange(symbol, currentMockPrices[symbol]);

  // Generate sparkline (random walk over ~20 points)
  const sparklineLength = 20;
  let lastSparklePrice = currentMockPrices[symbol];
  const sparkline: number[] = [];

  for (let i = 0; i < sparklineLength; i++) {
    const stepChange = (Math.random() - 0.5) * volatility * 2;
    lastSparklePrice *= (1 + stepChange);
    sparkline.push(Math.max(lastSparklePrice, 0.01));
  }

  // Calculate 24h change based on initial price vs current
  const initialPrice = INITIAL_PRICES[symbol] || 100;
  const change_24h = ((currentMockPrices[symbol] - initialPrice) / initialPrice) * 100;

  // Calculate high/low 24h (rough approximation from sparkline)
  const high_24h = Math.max(...sparkline) * (1 + volatility * 0.5);
  const low_24h = Math.min(...sparkline) * (1 - volatility * 0.5);

  // Volume - random but reasonable
  const volume_24h = Math.floor(Math.random() * 10000000) + 100000;

  return {
    symbol,
    price: Math.round(currentMockPrices[symbol] * 100) / 100, // 2 decimal places
    change_24h: Math.round(change_24h * 100) / 100, // 2 decimal places
    high_24h: Math.round(high_24h * 100) / 100,
    low_24h: Math.round(low_24h * 100) / 100,
    volume_24h,
    sparkline,
  };
}

// Exported functions for candle state management
// Initialize candle state for a symbol if not exists
export function initCandleState(symbol: string, timeframe: string) {
  const key = `${symbol}:${timeframe}`;
  if (!candleStates[key]) {
    // Use a recent time that aligns with the expected interval
    const now = Date.now();
    // Round down to the nearest interval (1s or 5s) to start clean
    const intervalMs = timeframe === '5s' ? 5000 : 1000;
    const lastUpdateTime = Math.floor(now / intervalMs) * intervalMs;

    candleStates[key] = {
      currentPrice: getCurrentMockPrice(symbol) || 100,
      lastUpdateTime: lastUpdateTime,
      candles: [], // Initialize with empty array
    };
  }
  return candleStates[key];
}

// Get cached candles (for initial load)
export function getCachedCandles(symbol: string, timeframe: string) {
  const key = `${symbol}:${timeframe}`;
  if (!candleStates[key]) {
    return generateMockCandles(symbol, timeframe, 500);
  }
  return candleStates[key].candles;
}

// Helper function for state key
export function getStateKey(symbol: string, timeframe: string): string {
  return `${symbol}:${timeframe}`;
}

// Track candle state per symbol+timeframe
export const candleStates: Record<string, { currentPrice: number; lastUpdateTime: number; candles: MockCandleData[] }> = {};

// Export the new candle generation function for use in TradePage
export function generateCandleAtTime(symbol: string, timeframe: string): MockCandleData {
  initCandleState(symbol, timeframe);
  const state = candleStates[getStateKey(symbol, timeframe)];
  const intervalMs = timeframe === '5s' ? 5000 : 1000;
  const volatility = VOLATILITY[symbol] || 0.002;

  // Calculate the next bucket time based on lastUpdateTime
  const nextBucketTime = state.lastUpdateTime + intervalMs;
  const bucketTime = new Date(nextBucketTime);

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

  state.currentPrice = close;
  state.lastUpdateTime = nextBucketTime;

  // Update state candles
  const key = getStateKey(symbol, timeframe);
  if (candleStates[key]) {
    candleStates[key].candles = [...candleStates[key].candles, candle].slice(-500);
  }

  return candle;
}

/**
 * Generate an "in-progress" candle update for the current time bucket.
 * This shows live price movement within the current candle (wicks growing, close updating).
 * Called on every price tick to update the chart in real-time.
 *
 * For 5s timeframe: updates the same candle wicks every tick until 5s period completes.
 * For 1s timeframe: updates the same candle wicks every tick until 1s period completes.
 */
export function generateLiveCandleUpdate(symbol: string, timeframe: string): MockCandleData | null {
  const key = getStateKey(symbol, timeframe);
  const state = candleStates[key];

  // Ensure state is initialized
  if (!state) {
    initCandleState(symbol, timeframe);
    const newState = candleStates[key];
    if (!newState || newState.candles.length === 0) {
      // Generate an initial candle if none exists
      generateCandleAtTime(symbol, timeframe);
    }
    return generateLiveCandleUpdate(symbol, timeframe);
  }

  // If no candles exist yet, generate one
  if (state.candles.length === 0) {
    generateCandleAtTime(symbol, timeframe);
  }

  // Get the last (current) candle
  const lastCandle = state.candles[state.candles.length - 1];
  const open = lastCandle.open;
  const currentPrice = state.currentPrice;

  // Calculate live high/low based on current price vs open
  // Use a smaller volatility factor for wick movement within the candle
  const WickVolatility = timeframe === '5s' ? 0.001 : 0.002;
  const high = Math.max(lastCandle.high, currentPrice, open) * (1 + Math.random() * WickVolatility);
  const low = Math.min(lastCandle.low, currentPrice, open) * (1 - Math.random() * WickVolatility);

  // Use the same bucket_time as the current candle (still in the same time bucket)
  const liveCandle: MockCandleData = {
    bucket_time: lastCandle.bucket_time,
    open: Number(open.toFixed(2)),
    high: Number(high.toFixed(2)),
    low: Number(low.toFixed(2)),
    close: Number(currentPrice.toFixed(2)),
    volume: lastCandle.volume + Math.floor(Math.random() * 100) + 10, // Increment volume
  };

  return liveCandle;
}

export function generateMockCandles(symbol: string, timeframe: string, count: number = 1): MockCandleData[] {
  initCandleState(symbol, timeframe);
  const state = candleStates[getStateKey(symbol, timeframe)];
  const intervalMs = timeframe === '5s' ? 5000 : 1000;
  const volatility = VOLATILITY[symbol] || 0.002;

  // Check if we've already generated 500+ candles
  const metadata = getTickMetadata(symbol, timeframe);
  if (metadata && metadata.totalGenerated >= 500) {
    // Return cached history instead
    return retrieveTickHistory(symbol, timeframe);
  }

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

  // Persist candles to storage
  const ticksToStore: TickData[] = candles.map(c => ({
    symbol,
    timeframe,
    bucket_time: c.bucket_time,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    volume: c.volume,
  }));

  storeTickHistory(ticksToStore);

  // Update metadata
  const newTotal = (metadata?.totalGenerated || 0) + count;
  updateTickMetadata({
    symbol,
    timeframe,
    totalGenerated: newTotal,
    lastGeneratedAt: Date.now(),
    oldestTickTime: candles[0] ? new Date(candles[0].bucket_time).getTime() : state.lastUpdateTime,
    newestTickTime: candles[candles.length - 1] ? new Date(candles[candles.length - 1].bucket_time).getTime() : state.lastUpdateTime,
  });

  // Keep only last 500 candles in memory
  const key = getStateKey(symbol, timeframe);
  if (candleStates[key]) {
    candleStates[key].candles = [...candleStates[key].candles, ...candles].slice(-500);
  }

  return candles;
}

// ========== CANDLE VALIDATION ==========

export interface CandleValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateCandleTimeframes(candles: MockCandleData[], timeframe: string): CandleValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!candles || candles.length === 0) {
    return { isValid: true, errors, warnings };
  }

  const expectedIntervalMs = timeframe === '5s' ? 5000 : 1000;
  const tolerance = timeframe === '5s' ? 200 : 100; // Allow ±200ms for 5s, ±100ms for 1s

  for (let i = 1; i < candles.length; i++) {
    try {
      const prevTime = new Date(candles[i - 1].bucket_time).getTime();
      const currTime = new Date(candles[i].bucket_time).getTime();
      const diff = currTime - prevTime;

      if (diff < expectedIntervalMs - tolerance || diff > expectedIntervalMs + tolerance) {
        errors.push(
          `Invalid interval between candle ${i - 1} and ${i}: ${diff}ms (expected ~${expectedIntervalMs}ms) at ${candles[i].bucket_time}`
        );
      }

      // Validate OHLC relationships
      if (candles[i].high < candles[i].low) {
        errors.push(`High < Low at candle ${i}: ${candles[i].high} < ${candles[i].low}`);
      }
      if (candles[i].open < candles[i].low || candles[i].open > candles[i].high) {
        warnings.push(`Open outside High/Low range at candle ${i}`);
      }
      if (candles[i].close < candles[i].low || candles[i].close > candles[i].high) {
        warnings.push(`Close outside High/Low range at candle ${i}`);
      }
    } catch (e) {
      errors.push(`Failed to parse timestamp at candle ${i}: ${candles[i].bucket_time}`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

// Persist the latest candles for a symbol+timeframe to localStorage
// Call this when switching symbols or timeframes to ensure latest data is saved
export function persistLatestCandles(symbol: string, timeframe: string): void {
  const key = getStateKey(symbol, timeframe);
  const state = candleStates[key];
  if (state && state.candles.length > 0) {
    // Convert to TickData format and store
    const ticksToStore = state.candles.map(c => ({
      symbol,
      timeframe,
      bucket_time: c.bucket_time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
    }));
    storeTickHistory(ticksToStore);
  }
}

// Reset all candle states (useful when switching modes)
export function resetCandleStates() {
  Object.keys(candleStates).forEach(key => {
    delete candleStates[key];
  });
}

function persistMockPrices(): void {
  // Calculate 24h change, high, low for each symbol based on current mock prices
  const initialPrice = INITIAL_PRICES;
  const allPrices = Object.keys(currentMockPrices).map(symbol => {
    const currentPrice = currentMockPrices[symbol];
    const init = initialPrice[symbol] || 100;
    const change_24h = ((currentPrice - init) / init) * 100;

    // Calculate high/low from the sparkline or current price trend
    // Since we don't maintain a full sparkline in currentMockPrices,
    // we derive high/low from the price movement direction
    const high_24h = Math.max(currentPrice, init) * 1.05; // 5% above max of init/current
    const low_24h = Math.min(currentPrice, init) * 0.95; // 5% below min of init/current
    const volume_24h = Math.floor(Math.random() * 10000000) + 100000;

    return {
      symbol,
      price: currentPrice,
      change_24h: Math.round(change_24h * 100) / 100,
      high_24h: Math.round(high_24h * 100) / 100,
      low_24h: Math.round(low_24h * 100) / 100,
      volume_24h,
      // Store a condensed sparkline snapshot (last 20 price points)
      sparkline: // Re-generate a brief sparkline representation
        (function() {
          const sparkline: number[] = [];
          let price = currentPrice;
          for (let i = 0; i < 20; i++) {
            const stepChange = (Math.random() - 0.5) * 0.02;
            price *= (1 + stepChange);
            sparkline.push(Math.max(price, 0.01));
          }
          return sparkline;
        })(),
    };
  });
  storeMockPrices(allPrices);
}

// Generate mock data for all known symbols
export function generateAllMockPrices(symbols: string[]): MockPriceData[] {
  initMockPrices(symbols);
  const results = symbols.map(symbol => generateMockTick(symbol));
  // Persist once after generating all prices (not during each tick)
  // This ensures prices survive page refreshes while maintaining evolving state
  persistMockPrices();
  return results;
}

// Reset prices to initial values (useful when switching back to online mode)
export function resetMockPrices(): void {
  currentMockPrices = {};
  isInitialized = false;
  priceSubscribers.clear();
  clearMockPrices();
}