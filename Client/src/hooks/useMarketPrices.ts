import { useEffect, useRef } from "react";
import { API_BASE_URL } from "../config";
import { generateAllMockPrices, resetMockPrices, MockPriceData } from "../data/mockPriceGenerator";

export interface MarketPriceData {
  symbol: string;
  price: number;
  change_24h: number;
  high_24h: number;
  low_24h: number;
  volume_24h: number;
  sparkline: number[];
}

export function useMarketPrices(onUpdate: (prices: MarketPriceData[]) => void) {
  const callbackRef = useRef(onUpdate);
  useEffect(() => { callbackRef.current = onUpdate; });

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    const isOnline = !!token;

    if (isOnline) {
      // Online mode: connect to WebSocket backend
      const wsUrl = API_BASE_URL.replace(/^http/, 'ws') + `/ws?token=${token}`;

      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        ws.send(JSON.stringify({ action: "subscribe", topic: "prices:all" }));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.topic === "prices:all" && Array.isArray(msg.data)) {
            callbackRef.current(msg.data);
          }
        } catch (err) {
          console.error("Failed to parse market prices WS message", err);
        }
      };

      return () => {
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close();
        }
      };
    } else {
      // Offline/fallback mode: use mock data that evolves over time
      // Initialize with known symbols if not already done
      const knownSymbols = ["Tech", "Meme", "BANK", "AAPL", "TSLA"];
      generateAllMockPrices(knownSymbols);

      // Generate initial mock prices
      const initialPrices = knownSymbols.map(symbol => ({
        symbol,
        price: currentPriceForSymbol(symbol),
        change_24h: 0,
        high_24h: 0,
        low_24h: 0,
        volume_24h: 0,
        sparkline: [],
      }));

      // Send initial mock data
      callbackRef.current(initialPrices);

      // Set up interval to update prices every second for realistic evolution
      const intervalId = setInterval(() => {
        const updatedPrices = knownSymbols.map(symbol => ({
          symbol,
          price: currentPriceForSymbol(symbol),
          change_24h: 0, // Will be recalculated
          high_24h: 0,
          low_24h: 0,
          volume_24h: 0,
          sparkline: [],
        }));

        callbackRef.current(updatedPrices);
      }, 1000);

      return () => {
        clearInterval(intervalId);
      };
    }
  }, []);
}

// Helper to get the current price for a symbol (from mock data)
function currentPriceForSymbol(symbol: string): number {
  // Ensure mock prices are initialized
  const knownSymbols = ["Tech", "Meme", "BANK", "AAPL", "TSLA"];
  if (!knownSymbols.includes(symbol)) return 100;

  // If not initialized, set initial price
  if (!(symbol in (global as any)._mockPrices)) {
    (global as any)._mockPrices = {};
    const initPrices: Record<string, number> = {
      Tech: 64230.50,
      Meme: 3380.20,
      BANK: 148.45,
      AAPL: 189.45,
      TSLA: 175.22,
    };
    for (const s of knownSymbols) {
      (global as any)._mockPrices[s] = initPrices[s] || 100;
    }
  }

  // Generate a new tick and return the price
  const data = generateMockTick(symbol);
  return data.price;
}
