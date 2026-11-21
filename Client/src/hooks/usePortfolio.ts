import { useState, useCallback, useMemo, useEffect, useContext } from 'react';
import { API_BASE_URL } from '../config';
import { storePortfolioState, retrievePortfolioState, clearPortfolioState } from '../data/mockStorage';
import { AuthContext } from '../context/AuthContext';

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
    AVAX: '#E84142', LINK: '#2A5ADA', DOGE: '#C2A633',
    NVDA: '#76B900',
    Tech: '#F7931A', Meme: '#627EEA', BANK: '#9945FF',
    AAPL: '#76B900', TSLA: '#E84142',
  };
  return colors[asset?.toUpperCase()] || '#888888';
};

export function usePortfolio() {
  const { accessToken } = useContext(AuthContext) || { accessToken: null };
  const [holdingsData, setHoldingsData] = useState<any[]>([]);
  const [cashBalance, setCashBalance] = useState(0);
  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const [isOffline, setIsOffline] = useState(false);

  // Initialize portfolio state from localStorage
  useEffect(() => {
    const storedState = retrievePortfolioState();
    setCashBalance(storedState.cashBalance || 100000);

    if (storedState.holdings.length > 0) {
      // Convert stored holdings to holdingsData format
      const formattedHoldings = storedState.holdings.map((h: any) => ({
        id: h.symbol,
        asset: h.symbol,
        name: h.symbol,
        quantity: h.quantity,
        avgPrice: h.avgPrice,
        currentPrice: h.currentPrice,
        change24hPercent: 0,
        color: getAssetColor(h.symbol),
        sparklineData: Array(8).fill(h.currentPrice),
      }));
      setHoldingsData(formattedHoldings);
    }
  }, []);

  const updatePrice = useCallback((symbol: string, newPrice: number, change24h: number) => {
    setHoldingsData(prev => prev.map(h => {
      if (h.asset.toLowerCase() !== symbol.toLowerCase()) return h;

      const sparklineData = h.sparklineData || Array(8).fill(newPrice);
      const newSparkline = [...sparklineData.slice(1), newPrice];

      return { ...h, currentPrice: newPrice, change24hPercent: change24h, sparklineData: newSparkline };
    }));
  }, []);

  useEffect(() => {
    // Determine online/offline mode from AuthContext
    const isOnline = !!accessToken;

    if (!isOnline) {
      console.warn('WebSocket: No auth token found. Running in offline mode.');
      setIsOffline(true);
      // Initialize offline portfolio state if needed
      const storedState = retrievePortfolioState();
      if (storedState.holdings.length === 0 && cashBalance === 0) {
        setCashBalance(100000);
      }
      return;
    }

    const wsUrl = API_BASE_URL.replace(/^http/, 'ws') + `/ws?token=${accessToken}`;
    let ws: WebSocket;
    let reconnectTimeout: ReturnType<typeof setTimeout>;

    const connect = () => {
      setWsStatus('connecting');
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('[WS] Connected');
        setWsStatus('connected');
        setIsOffline(false);
        ws.send(JSON.stringify({ action: 'subscribe', topic: 'portfolio:data' }));
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);

          // --- Handle initial portfolio data ---
          if (payload.data?.portfolio) {
            const portfolio = payload.data.portfolio;
            console.log('[WS] Portfolio snapshot received. Balance:', portfolio.balance, 'Holdings:', portfolio.holdings?.length);
            setCashBalance(portfolio.balance || 0);

            if (portfolio.holdings) {
              const formattedHoldings = portfolio.holdings.map((h: any) => ({
                id: h.symbol,
                asset: h.symbol,
                name: h.symbol,
                quantity: h.quantity,
                avgPrice: h.avg_price || 0,
                currentPrice: h.current_price || h.avg_price || 0,
                change24hPercent: 0,
                color: getAssetColor(h.symbol),
                sparklineData: Array(8).fill(h.current_price || h.avg_price || 0),
              }));
              setHoldingsData(formattedHoldings);
            }
            return;
          }

          // --- Handle live price updates ---
          const type = payload.type || payload.event || payload.action;
          const symbol = payload.asset || payload.symbol || payload.ticker;
          const price = payload.newPrice ?? payload.price ?? payload.current_price;
          const change = payload.change24h ?? payload.change24hPercent ?? 0;

          if (type === 'PRICE_UPDATE' && symbol != null && price != null) {
            console.log(`[WS] Price update: ${symbol} -> ${price} (${change}%)`);
            updatePrice(symbol, price, change);
            return;
          }

          // --- Catch-all for unrecognized messages ---
          console.log('[WS] Unhandled message type:', type, payload);
        } catch (error) {
          console.error('[WS] Failed to parse message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('[WS] Error:', error);
        setWsStatus('error');
      };

      ws.onclose = (event) => {
        console.log(`[WS] Closed (code: ${event.code}, reason: ${event.reason})`);
        setWsStatus('disconnected');

        // Auto-reconnect after 3 seconds unless it was a clean close
        if (event.code !== 1000) {
          reconnectTimeout = setTimeout(connect, 3000);
        }
      };
    };

    connect();

    return () => {
      clearTimeout(reconnectTimeout);
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        ws.close(1000, 'Component unmounted');
      }
    };
  }, [accessToken, updatePrice]);

  // Persist portfolio state whenever holdings or cash balance change
  useEffect(() => {
    const state = {
      cashBalance,
      holdings: holdingsData.map(h => ({
        symbol: h.asset,
        quantity: h.quantity,
        avgPrice: h.avgPrice,
        currentPrice: h.currentPrice,
        unrealizedPnL: h.unrealizedPnL,
        pnLPercentage: h.pnLPercentage,
      })),
      totalValue: holdingsData.reduce((sum, h) => sum + h.value, 0) + cashBalance,
      totalUnrealizedPnL: holdingsData.reduce((sum, h) => sum + h.unrealizedPnL, 0),
      totalPnLPercentage: (() => {
        const totalCost = holdingsData.reduce((sum, h) => sum + h.quantity * h.avgPrice, 0);
        return totalCost > 0 ? (holdingsData.reduce((sum, h) => sum + h.unrealizedPnL, 0) / totalCost) * 100 : 0;
      })(),
    };
    storePortfolioState(state);
  }, [holdingsData, cashBalance]);

  // --- Math engine ---
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
    return rawHoldings.map(h => ({ ...h, portfolioWeight: totalValue > 0 ? (h.value / (totalValue - cashBalance)) * 100 : 0 }));
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

  // Function to execute a trade (buy/sell) and update portfolio
  const executeTrade = useCallback((symbol: string, side: 'buy' | 'sell', quantity: number, price: number) => {
    setHoldingsData(prev => {
      const existing = prev.find(h => h.asset.toLowerCase() === symbol.toLowerCase());

      if (side === 'buy') {
        const cost = quantity * price;
        if (cost > cashBalance) return prev; // Insufficient funds

        setCashBalance(cb => cb - cost);

        if (existing) {
          // Average down/up
          const newQuantity = existing.quantity + quantity;
          const newAvgPrice = ((existing.quantity * existing.avgPrice) + cost) / newQuantity;
          return prev.map(h =>
            h.asset.toLowerCase() === symbol.toLowerCase()
              ? { ...h, quantity: newQuantity, avgPrice: newAvgPrice }
              : h
          );
        } else {
          // New position
          return [...prev, {
            id: symbol,
            asset: symbol,
            name: symbol,
            quantity,
            avgPrice: price,
            currentPrice: price,
            change24hPercent: 0,
            color: getAssetColor(symbol),
            sparklineData: Array(8).fill(price),
          }];
        }
      } else {
        // Sell
        if (!existing || existing.quantity < quantity) return prev; // Not enough quantity

        const proceeds = quantity * price;
        setCashBalance(cb => cb + proceeds);

        const newQuantity = existing.quantity - quantity;
        if (newQuantity <= 0) {
          return prev.filter(h => h.asset.toLowerCase() !== symbol.toLowerCase());
        } else {
          return prev.map(h =>
            h.asset.toLowerCase() === symbol.toLowerCase()
              ? { ...h, quantity: newQuantity }
              : h
          );
        }
      }
    });
  }, [cashBalance]);

  // Function to update cash balance directly (e.g., for deposits/withdrawals)
  const updateCashBalance = useCallback((amount: number) => {
    setCashBalance(cb => Math.max(0, cb + amount));
  }, []);

  // Clear portfolio (for logout or reset)
  const clearPortfolio = useCallback(() => {
    setHoldingsData([]);
    setCashBalance(100000);
    clearPortfolioState();
  }, []);

  return {
    holdings,
    cashBalance,
    totalPortfolioValue,
    totalUnrealizedPnL,
    totalPnLPercentage,
    riskMetrics,
    concentrationWarning,
    wsStatus,
    updatePrice,
    executeTrade,
    updateCashBalance,
    clearPortfolio,
    isOffline,
  };
}