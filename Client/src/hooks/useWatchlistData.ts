import { useState, useEffect, useCallback, useRef, useContext } from 'react';
import { API_BASE_URL } from '../config';
import { MarketPriceData } from './useMarketPrices';
import { retrieveWatchlist, retrieveMockPrices } from '../data/mockStorage';
import { subscribeToPrice, generateAllMockPrices, initMockPrices } from '../data/mockPriceGenerator';
import { AuthContext } from '../context/AuthContext';

const POLL_INTERVAL_MS = 10_000;

// Default symbols for offline mode
const DEFAULT_OFFLINE_SYMBOLS = ["Tech", "Meme", "BANK", "AAPL", "TSLA"];

export function useWatchlistData(watchlistSymbols: string[] = []) {
  const { accessToken } = useContext(AuthContext) || { accessToken: null };
  // Use a stable reference for the dependency array - default param creates new [] each render
  const stableWatchlistSymbols = watchlistSymbols.length > 0 ? watchlistSymbols : null;
  const [data, setData] = useState<MarketPriceData[]>([]);
  const [loading, setLoading] = useState(true);
  const subsRef = useRef<Map<string, () => void>>(new Map());
  const initializedRef = useRef(false);

  // Use ref to store the latest fetchWatchlist function so the effect doesn't
  // re-run when accessToken changes (which would cause infinite re-renders)
  const fetchWatchlistRef = useRef<typeof fetchWatchlist>();

  const fetchWatchlist = useCallback(async (symbols: string[] = []) => {
    // Determine online/offline mode from AuthContext
    const isOnline = !!accessToken;

    // Offline mode: use mock data from localStorage
    if (!isOnline) {
      const storedSymbols = retrieveWatchlist();
      // Use passed symbols if available, otherwise use stored symbols, otherwise defaults
      const symbolsToUse = symbols.length > 0 ? symbols : (storedSymbols.length > 0 ? storedSymbols : DEFAULT_OFFLINE_SYMBOLS);

      // Ensure mock prices are initialized
      if (!initializedRef.current) {
        initMockPrices(symbolsToUse);
        initializedRef.current = true;
      }

      const mockPrices = retrieveMockPrices();

      // If no mock prices exist, generate them
      if (mockPrices.length === 0) {
        generateAllMockPrices(symbolsToUse);
        // Retrieve again after generation
        const newMockPrices = retrieveMockPrices();
        // Filter mock prices to only include watchlist symbols
        const watchlistData = newMockPrices.filter(p =>
          symbolsToUse.includes(p.symbol)
        );
        setData(watchlistData);
      } else {
        // Filter mock prices to only include watchlist symbols
        const watchlistData = mockPrices.filter(p =>
          symbolsToUse.includes(p.symbol)
        );
        setData(watchlistData);
      }

      setLoading(false);

      // Subscribe to live price updates for each symbol
      symbolsToUse.forEach(symbol => {
        if (!subsRef.current.has(symbol)) {
          const unsubscribe = subscribeToPrice(symbol, (price) => {
            setData(prev => prev.map(item =>
              item.symbol === symbol ? { ...item, price } : item
            ));
          });
          subsRef.current.set(symbol, unsubscribe);
        }
      });

      // Cleanup subscriptions for removed symbols
      const currentSymbols = new Set(symbolsToUse);
      subsRef.current.forEach((unsub, symbol) => {
        if (!currentSymbols.has(symbol)) {
          unsub();
          subsRef.current.delete(symbol);
        }
      });

      return;
    }

    // Online mode: fetch from API
    try {
      const res = await fetch(`${API_BASE_URL}/watchlist`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (Array.isArray(json.data)) {
        setData(json.data as MarketPriceData[]);
      }
    } catch (err) {
      console.error('Failed to fetch watchlist data:', err);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  // Update the ref whenever fetchWatchlist changes
  fetchWatchlistRef.current = fetchWatchlist;

  useEffect(() => {
    // Use the stable ref version to avoid re-running when accessToken changes
    fetchWatchlistRef.current?.(stableWatchlistSymbols || []);
    const interval = setInterval(() => fetchWatchlistRef.current?.(stableWatchlistSymbols || []), POLL_INTERVAL_MS);
    return () => {
      clearInterval(interval);
      // Cleanup all subscriptions on unmount
      subsRef.current.forEach(unsub => unsub());
      subsRef.current.clear();
    };
  }, [stableWatchlistSymbols]);

  return { data, loading, refetch: fetchWatchlistRef.current };
}