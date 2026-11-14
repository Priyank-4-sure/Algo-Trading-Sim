// src/data/mockPriceGenerator.ts
// Generates evolving mock market prices with realistic random walks
// When backend is unavailable, this provides persistent fake data

export interface MockPriceData {
  symbol: string;
  price: number;
  change_24h: number;
  high_24h: number;
  low_24h: number;
  volume_24h: number;
  sparkline: number[];
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

// 24h change range per symbol
const CHANGE_24H_RANGE: Record<string, [number, number]> = {
  Tech: [-3, 3],
  Meme: [-4, 4],
  BANK: [-2, 2],
  AAPL: [-2, 2],
  TSLA: [-3, 3],
};

// Track current prices so they evolve persistently
let currentPrices: Record<string, number> = {};

// Initialize prices if not already done
export function initMockPrices(symbols: string[]) {
  for (const symbol of symbols) {
    if (!(symbol in currentPrices)) {
      currentPrices[symbol] = INITIAL_PRICES[symbol] || 100;
    }
  }
}

// Generate a single price tick with random walk
export function generateMockTick(symbol: string): MockPriceData {
  // Ensure prices are initialized
  if (!(symbol in currentPrices)) {
    currentPrices[symbol] = INITIAL_PRICES[symbol] || 100;
  }

  const volatility = VOLATILITY[symbol] || 0.02;
  const [minChange, maxChange] = CHANGE_24H_RANGE[symbol] || [-3, 3];

  // Random walk: small random change
  const changePercent = (Math.random() * (maxChange - minChange) + minChange) / 100;
  const newPrice = currentPrices[symbol] * (1 + changePercent);

  // Clamp to reasonable positive values
  currentPrices[symbol] = Math.max(newPrice, 0.01);

  // Generate sparkline (random walk over ~20 points)
  // Initialize sparkline if needed
  if (!(symbol in currentPrices) || !currentPrices[symbol]) {
    // This shouldn't happen but just in case
  }

  // Create a simple sparkline with some randomness
  const sparklineLength = 20;
  let lastSparklePrice = currentPrices[symbol];
  const sparkline: number[] = [];

  for (let i = 0; i < sparklineLength; i++) {
    const stepChange = (Math.random() - 0.5) * volatility * 2;
    lastSparklePrice *= (1 + stepChange);
    sparkline.push(Math.max(lastSparklePrice, 0.01));
  }

  // Calculate 24h change based on initial price vs current
  const initialPrice = INITIAL_PRICES[symbol] || 100;
  const change_24h = ((currentPrices[symbol] - initialPrice) / initialPrice) * 100;

  // Calculate high/low 24h (rough approximation from sparkline)
  const high_24h = Math.max(...sparkline) * (1 + volatility * 0.5);
  const low_24h = Math.min(...sparkline) * (1 - volatility * 0.5);

  // Volume - random but reasonable
  const volume_24h = Math.floor(Math.random() * 10000000) + 100000;

  return {
    symbol,
    price: Math.round(currentPrices[symbol] * 100) / 100, // 2 decimal places
    change_24h: Math.round(change_24h * 100) / 100, // 2 decimal places
    high_24h: Math.round(high_24h * 100) / 100,
    low_24h: Math.round(low_24h * 100) / 100,
    volume_24h,
    sparkline,
  };
}

// Generate mock data for all known symbols
export function generateAllMockPrices(symbols: string[]): MockPriceData[] {
  initMockPrices(symbols);
  return symbols.map(symbol => generateMockTick(symbol));
}

// Reset prices to initial values (useful when switching back to online mode)
export function resetMockPrices() {
  currentPrices = {};
}