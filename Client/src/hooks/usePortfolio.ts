import { useState, useCallback, useMemo } from 'react';

export interface Holding {
  id: string;
  asset: string;
  name: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  change24hPercent: number;
  color: string;
  sparklineData: number[];
  value: number;
  unrealizedPnL: number;
  pnLPercentage: number;
  portfolioWeight: number;
}

const INITIAL_HOLDINGS: Omit<Holding, 'value' | 'unrealizedPnL' | 'pnLPercentage' | 'portfolioWeight'>[] = [
  { id: 'btc', asset: 'BTC', name: 'Bitcoin', quantity: 0.452, avgPrice: 58200, currentPrice: 64230.50, change24hPercent: 2.45, color: '#F7931A', sparklineData: [58000, 59200, 60100, 59800, 61500, 62800, 63100, 64230] },
  { id: 'eth', asset: 'ETH', name: 'Ethereum', quantity: 5.8, avgPrice: 3100, currentPrice: 3380.20, change24hPercent: -1.12, color: '#627EEA', sparklineData: [3200, 3350, 3280, 3420, 3380, 3310, 3390, 3380] },
  { id: 'sol', asset: 'SOL', name: 'Solana', quantity: 45, avgPrice: 120, currentPrice: 148.45, change24hPercent: 5.3, color: '#9945FF', sparklineData: [125, 130, 128, 135, 140, 138, 145, 148] },
  { id: 'avax', asset: 'AVAX', name: 'Avalanche', quantity: 80, avgPrice: 28, currentPrice: 35.60, change24hPercent: 3.1, color: '#E84142', sparklineData: [29, 30, 31, 30.5, 32, 33, 34, 35.6] },
  { id: 'link', asset: 'LINK', name: 'Chainlink', quantity: 150, avgPrice: 12, currentPrice: 14.85, change24hPercent: -0.8, color: '#2A5ADA', sparklineData: [13, 13.5, 14, 13.8, 14.2, 14.5, 14.9, 14.85] },
];

export function usePortfolio() {
  const [holdingsData, setHoldingsData] = useState(INITIAL_HOLDINGS);
  const [cashBalance] = useState(13467.82);

  const holdings: Holding[] = useMemo(() => {
    const rawHoldings = holdingsData.map(h => {
      const value = h.quantity * h.currentPrice;
      const costBasis = h.quantity * h.avgPrice;
      const unrealizedPnL = value - costBasis;
      const pnLPercentage = ((h.currentPrice - h.avgPrice) / h.avgPrice) * 100;
      return { ...h, value, unrealizedPnL, pnLPercentage, portfolioWeight: 0 };
    });
    const totalValue = rawHoldings.reduce((sum, h) => sum + h.value, 0) + cashBalance;
    return rawHoldings.map(h => ({ ...h, portfolioWeight: (h.value / totalValue) * 100 }));
  }, [holdingsData, cashBalance]);

  const totalPortfolioValue = useMemo(() =>
    holdings.reduce((sum, h) => sum + h.value, 0) + cashBalance
  , [holdings, cashBalance]);

  const totalUnrealizedPnL = useMemo(() =>
    holdings.reduce((sum, h) => sum + h.unrealizedPnL, 0)
  , [holdings]);

  const totalPnLPercentage = useMemo(() => {
    const totalCost = holdings.reduce((sum, h) => sum + h.quantity * h.avgPrice, 0);
    return totalCost > 0 ? (totalUnrealizedPnL / totalCost) * 100 : 0;
  }, [holdings, totalUnrealizedPnL]);

  const riskMetrics = useMemo(() => ({
    sharpeRatio: 1.85,
    maxDrawdown: -12.4,
    volatility: 24.6,
    winRate: 68.2,
  }), []);

  const concentrationWarning = useMemo(() => {
    const maxHolding = holdings.reduce((prev, curr) => curr.portfolioWeight > prev.portfolioWeight ? curr : prev, holdings[0]);
    return maxHolding ? { asset: maxHolding.asset, percentage: maxHolding.portfolioWeight } : null;
  }, [holdings]);

  const updatePrice = useCallback((id: string, newPrice: number, change24h: number) => {
    setHoldingsData(prev => prev.map(h => {
      if (h.id !== id) return h;
      const newSparkline = [...h.sparklineData.slice(1), newPrice];
      return { ...h, currentPrice: newPrice, change24hPercent: change24h, sparklineData: newSparkline };
    }));
  }, []);

  return { holdings, cashBalance, totalPortfolioValue, totalUnrealizedPnL, totalPnLPercentage, riskMetrics, concentrationWarning, updatePrice };
}
