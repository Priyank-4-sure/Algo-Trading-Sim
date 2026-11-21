// src/data/mockStorage.ts
// Persistent mock data storage using localStorage
// Ensures prices, orders, and portfolio state survive page refreshes

export interface MockPriceData {
  symbol: string;
  price: number;
  change_24h: number;
  high_24h: number;
  low_24h: number;
  volume_24h: number;
  sparkline: number[];
}


// Store current mock prices to localStorage
export function storeMockPrices(prices: MockPriceData[]): void {
  try {
    localStorage.setItem('mockPrices', JSON.stringify(prices));
  } catch (e) {
    console.error('Failed to store mock prices:', e);
  }
}

// Retrieve stored mock prices from localStorage
export function retrieveMockPrices(): MockPriceData[] {
  try {
    const stored = localStorage.getItem('mockPrices');
    if (!stored) return [];
    return JSON.parse(stored) as MockPriceData[];
  } catch (e) {
    console.error('Failed to retrieve mock prices:', e);
    return [];
  }
}

// Clear stored mock prices (e.g., when switching back to online mode)
export function clearMockPrices(): void {
  try {
    localStorage.removeItem('mockPrices');
  } catch (e) {
    console.error('Failed to clear mock prices:', e);
  }
}

// === ORDER PERSISTENCE ===

export interface StoredOrder {
  id: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  side: 'buy' | 'sell';
  price: number;
  quantity: number;
  status: 'pending' | 'filled' | 'cancelled';
  createdAt: number;
  filledAt?: number;
}

export function storeOrder(order: StoredOrder): void {
  try {
    const orders = getStoredOrders();
    orders.push(order);
    localStorage.setItem('pendingOrders', JSON.stringify(orders));
  } catch (e) {
    console.error('Failed to store order:', e);
  }
}

export function getStoredOrders(): StoredOrder[] {
  try {
    const stored = localStorage.getItem('pendingOrders');
    if (!stored) return [];
    return JSON.parse(stored) as StoredOrder[];
  } catch (e) {
    console.error('Failed to retrieve stored orders:', e);
    return [];
  }
}

export function updateOrderStatus(orderId: string, status: 'pending' | 'filled' | 'cancelled', filledAt?: number): void {
  try {
    const orders = getStoredOrders();
    const order = orders.find(o => o.id === orderId);
    if (order) {
      order.status = status;
      if (filledAt) order.filledAt = filledAt;
      localStorage.setItem('pendingOrders', JSON.stringify(orders));
    }
  } catch (e) {
    console.error('Failed to update order status:', e);
  }
}

export function removeOrder(orderId: string): void {
  try {
    const orders = getStoredOrders().filter(o => o.id !== orderId);
    localStorage.setItem('pendingOrders', JSON.stringify(orders));
  } catch (e) {
    console.error('Failed to remove order:', e);
  }
}

// === PORTFOLIO/PnL PERSISTENCE ===

export interface PortfolioState {
  cashBalance: number;
  holdings: {
    symbol: string;
    quantity: number;
    avgPrice: number;
    currentPrice: number;
    unrealizedPnL: number;
    pnLPercentage: number;
  }[];
  totalValue: number;
  totalUnrealizedPnL: number;
  totalPnLPercentage: number;
}

export function storePortfolioState(state: PortfolioState): void {
  try {
    localStorage.setItem('portfolioState', JSON.stringify(state));
  } catch (e) {
    console.error('Failed to store portfolio state:', e);
  }
}

export function retrievePortfolioState(): PortfolioState {
  try {
    const stored = localStorage.getItem('portfolioState');
    if (!stored) {
      return {
        cashBalance: 100000,
        holdings: [],
        totalValue: 100000,
        totalUnrealizedPnL: 0,
        totalPnLPercentage: 0,
      };
    }
    return JSON.parse(stored) as PortfolioState;
  } catch (e) {
    console.error('Failed to retrieve portfolio state:', e);
    return {
      cashBalance: 100000,
      holdings: [],
      totalValue: 100000,
      totalUnrealizedPnL: 0,
      totalPnLPercentage: 0,
    };
  }
}

export function clearPortfolioState(): void {
  try {
    localStorage.removeItem('portfolioState');
  } catch (e) {
    console.error('Failed to clear portfolio state:', e);
  }
}

// === WATCHLIST PERSISTENCE ===

export function storeWatchlist(symbols: string[]): void {
  try {
    localStorage.setItem('offline_watchlist', JSON.stringify(symbols));
  } catch (e) {
    console.error('Failed to store watchlist:', e);
  }
}

export function retrieveWatchlist(): string[] {
  try {
    const stored = localStorage.getItem('offline_watchlist');
    if (!stored) return [];
    return JSON.parse(stored) as string[];
  } catch (e) {
    console.error('Failed to retrieve watchlist:', e);
    return [];
  }
}

// === TICK HISTORY PERSISTENCE ===

export interface TickData {
  symbol: string;
  timeframe: string;
  bucket_time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TickMetadata {
  symbol: string;
  timeframe: string;
  totalGenerated: number;
  lastGeneratedAt: number;
  oldestTickTime: number;
  newestTickTime: number;
}

const MAX_TICKS_PER_TIMEFRAME = 500;

export function storeTickHistory(ticks: TickData[]): void {
  try {
    if (!ticks || ticks.length === 0) return;

    // Group by symbol:timeframe
    const grouped: Record<string, TickData[]> = {};
    ticks.forEach(tick => {
      const key = `${tick.symbol}:${tick.timeframe}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(tick);
    });

    // Store each group, keeping only last MAX_TICKS_PER_TIMEFRAME
    Object.entries(grouped).forEach(([key, ticksToStore]) => {
      const existing = retrieveTickHistory(key.split(':')[0], key.split(':')[1]);
      const combined = [...existing, ...ticksToStore].slice(-MAX_TICKS_PER_TIMEFRAME);
      localStorage.setItem(`tickHistory:${key}`, JSON.stringify(combined));
      // Also update metadata - retrieve current metadata first
      const metaKey = `tickMetadata:${key.split(':')[0]}:${key.split(':')[1]}`;
      const storedMeta = typeof window !== 'undefined' ? localStorage.getItem(metaKey) : null;
      const existingMeta = storedMeta ? JSON.parse(storedMeta) : {
        symbol: key.split(':')[0],
        timeframe: key.split(':')[1],
        totalGenerated: 0,
        lastGeneratedAt: 0,
        oldestTickTime: Date.now(),
        newestTickTime: 0,
      };
      // Merge tick counts
      const newTotal = (existingMeta.totalGenerated || 0) + ticksToStore.length;
      const newOldest = existingMeta.oldestTickTime;
      const newNewest = Math.max(
        existingMeta.newestTickTime,
        ...ticksToStore.map(t => new Date(t.bucket_time).getTime())
      );
      const newMeta: TickMetadata = {
        symbol: key.split(':')[0],
        timeframe: key.split(':')[1],
        totalGenerated: newTotal,
        lastGeneratedAt: Date.now(),
        oldestTickTime: newOldest,
        newestTickTime: newNewest,
      };
      localStorage.setItem(metaKey, JSON.stringify(newMeta));
    });
  } catch (e) {
    console.error('Failed to store tick history:', e);
  }
}

export function retrieveTickHistory(symbol: string, timeframe: string): TickData[] {
  try {
    const key = `tickHistory:${symbol}:${timeframe}`;
    const stored = localStorage.getItem(key);
    if (!stored) return [];
    return JSON.parse(stored) as TickData[];
  } catch (e) {
    console.error('Failed to retrieve tick history:', e);
    return [];
  }
}

export function getTickMetadata(symbol: string, timeframe: string): TickMetadata | null {
  try {
    const key = `tickMetadata:${symbol}:${timeframe}`;
    const stored = localStorage.getItem(key);
    if (!stored) return null;
    return JSON.parse(stored) as TickMetadata;
  } catch (e) {
    console.error('Failed to retrieve tick metadata:', e);
    return null;
  }
}

export function updateTickMetadata(meta: TickMetadata): void {
  try {
    const key = `tickMetadata:${meta.symbol}:${meta.timeframe}`;
    localStorage.setItem(key, JSON.stringify(meta));
  } catch (e) {
    console.error('Failed to update tick metadata:', e);
  }
}

export function clearTickHistory(symbol: string, timeframe: string): void {
  try {
    localStorage.removeItem(`tickHistory:${symbol}:${timeframe}`);
    localStorage.removeItem(`tickMetadata:${symbol}:${timeframe}`);
  } catch (e) {
    console.error('Failed to clear tick history:', e);
  }
}

export function clearAllTickHistory(): void {
  try {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('tickHistory:') || key.startsWith('tickMetadata:')) {
        localStorage.removeItem(key);
      }
    });
  } catch (e) {
    console.error('Failed to clear all tick history:', e);
  }
}

// === ORDERBOOK PERSISTENCE ===

export interface OrderbookLevel {
  price: number;
  quantity: number;
}

export interface Orderbook {
  symbol: string;
  timestamp: number;
  bids: OrderbookLevel[];
  asks: OrderbookLevel[];
  spread: number;
  midPrice: number;
}

export function storeOrderbook(orderbook: Orderbook): void {
  try {
    const key = `orderbook:${orderbook.symbol}`;
    localStorage.setItem(key, JSON.stringify(orderbook));
  } catch (e) {
    console.error('Failed to store orderbook:', e);
  }
}

export function retrieveOrderbook(symbol: string): Orderbook | null {
  try {
    const key = `orderbook:${symbol}`;
    const stored = localStorage.getItem(key);
    if (!stored) return null;
    return JSON.parse(stored) as Orderbook;
  } catch (e) {
    console.error('Failed to retrieve orderbook:', e);
    return null;
  }
}

export function clearOrderbook(symbol: string): void {
  try {
    localStorage.removeItem(`orderbook:${symbol}`);
  } catch (e) {
    console.error('Failed to clear orderbook:', e);
  }
}

export function clearAllOrderbooks(): void {
  try {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('orderbook:')) {
        localStorage.removeItem(key);
      }
    });
  } catch (e) {
    console.error('Failed to clear all orderbooks:', e);
  }
}

// === OFFLINE MODE TOGGLE ===

export function isOfflineMode(): boolean {
  try {
    // Check if we're explicitly in offline mode or if no backend token exists
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    return !token; // Offline when no auth token
  } catch (e) {
    return true; // Safe default: assume offline if storage fails
  }
}

export function setOfflineMode(offline: boolean): void {
  try {
    if (offline) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
    }
  } catch (e) {
    console.error('Failed to set offline mode:', e);
  }
}