import { useState, useCallback, useMemo, useEffect } from 'react';

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

const getAssetColor = (asset: string) => {
  const colors: Record<string, string> = {
    BTC: '#F7931A', ETH: '#627EEA', SOL: '#9945FF',
    AVAX: '#E84142', LINK: '#2A5ADA'
  };
  return colors[asset?.toUpperCase()] || '#888888'; 
};

export function usePortfolio() {
  // 1. Start with an empty table and 0 cash
  const [holdingsData, setHoldingsData] = useState<any[]>([]);
  const [cashBalance, setCashBalance] = useState(0); 

  // 2. The function that changes the price on the screen
  const updatePrice = useCallback((id: string, newPrice: number, change24h: number) => {
    setHoldingsData(prev => prev.map(h => {
      // Find the coin that matches the Walkie-Talkie message
      if (h.asset.toLowerCase() !== id.toLowerCase()) return h;
      
      const sparklineData = h.sparklineData || Array(8).fill(newPrice);
      const newSparkline = [...sparklineData.slice(1), newPrice];
      
      return { ...h, currentPrice: newPrice, change24hPercent: change24h, sparklineData: newSparkline };
    }));
  }, []);

  // 3. The websocketConnection
  useEffect(() => {
    const token = localStorage.getItem('access_token'); 
    
    if (!token) {
      console.warn('WebSocket connection aborted: No authentication token available.');
      return;
    }

    const wsUrl = `ws://localhost:8080/v1/ws?token=${token}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('🟢 WebSocket connected! Asking for menu...');
      ws.send(JSON.stringify({ action: 'subscribe', topic: 'portfolio:data' }));
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);

        // A. Is this the Initial Data? (The Full Table)
        if (payload.data && payload.data.portfolio) {
           console.log('🍽️ Initial Food Arrived:', payload.data.portfolio);
           setCashBalance(payload.data.portfolio.balance || 0);
           
           if (payload.data.portfolio.holdings) {
               // Dress up the raw data with colors and starting prices
               const formattedHoldings = payload.data.portfolio.holdings.map((dbHolding: any) => ({
                   id: dbHolding.symbol,
                   asset: dbHolding.symbol,
                   name: dbHolding.symbol, 
                   quantity: dbHolding.quantity,
                   avgPrice: 100, // Using 100 as a fake buy price so PnL works
                   currentPrice: 100, 
                   change24hPercent: 0, 
                   color: getAssetColor(dbHolding.symbol),
                   sparklineData: Array(8).fill(100) 
               }));
               setHoldingsData(formattedHoldings);
           }
        }
        
        // B. Is this a fast Price Update? (The live ticks)
        if (payload.type === 'PRICE_UPDATE') {
          updatePrice(payload.asset.toLowerCase(), payload.newPrice, payload.change24h);
        }

      } catch (error) {
        console.error('Failed to parse incoming WebSocket payload:', error);
      }
    };

    ws.onerror = (error) => {
      if (ws.readyState !== WebSocket.CLOSED) console.error('🔴 Walkie-Talkie Error:', error);
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) ws.close();
    };
  }, [updatePrice]);

  // 4. The Math Engine (Calculates PnL automatically based on real data)
  const holdings: Holding[] = useMemo(() => {
    if (!holdingsData.length) return []; 

    const rawHoldings = holdingsData.map(h => {
      const value = h.quantity * h.currentPrice;
      const costBasis = h.quantity * h.avgPrice;
      const unrealizedPnL = value - costBasis;
      const pnLPercentage = h.avgPrice > 0 ? ((h.currentPrice - h.avgPrice) / h.avgPrice) * 100 : 0;
      return { ...h, value, unrealizedPnL, pnLPercentage, portfolioWeight: 0 };
    });
    
    const totalValue = rawHoldings.reduce((sum, h) => sum + h.value, 0) + cashBalance;
    return rawHoldings.map(h => ({ ...h, portfolioWeight: totalValue > 0 ? (h.value / totalValue) * 100 : 0 }));
  }, [holdingsData, cashBalance]);

  const totalPortfolioValue = useMemo(() => holdings.reduce((sum, h) => sum + h.value, 0) + cashBalance, [holdings, cashBalance]);
  const totalUnrealizedPnL = useMemo(() => holdings.reduce((sum, h) => sum + h.unrealizedPnL, 0), [holdings]);
  const totalPnLPercentage = useMemo(() => {
    const totalCost = holdings.reduce((sum, h) => sum + h.quantity * h.avgPrice, 0);
    return totalCost > 0 ? (totalUnrealizedPnL / totalCost) * 100 : 0;
  }, [holdings, totalUnrealizedPnL]);

  const riskMetrics = useMemo(() => ({ sharpeRatio: 1.85, maxDrawdown: -12.4, volatility: 24.6, winRate: 68.2 }), []);
  const concentrationWarning = useMemo(() => {
    if (!holdings.length) return null;
    const maxHolding = holdings.reduce((prev, curr) => curr.portfolioWeight > prev.portfolioWeight ? curr : prev, holdings[0]);
    return maxHolding && maxHolding.portfolioWeight > 40 ? { asset: maxHolding.asset, percentage: maxHolding.portfolioWeight } : null;
  }, [holdings]);

  return { holdings, cashBalance, totalPortfolioValue, totalUnrealizedPnL, totalPnLPercentage, riskMetrics, concentrationWarning, updatePrice };
}