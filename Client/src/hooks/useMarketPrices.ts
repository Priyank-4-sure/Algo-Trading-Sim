import { useEffect, useRef, useContext } from "react";
import { API_BASE_URL } from "../config";
import {
  generateAllMockPrices,
  generateMockTick,
  generateOrderbook,
  OrderbookData,
  resetMockPrices,
} from "../data/mockPriceGenerator";
import { AuthContext } from "../context/AuthContext";

export interface MarketPriceData {
  symbol: string;
  price: number;
  change_24h: number;
  high_24h: number;
  low_24h: number;
  volume_24h: number;
  sparkline: number[];
}

export function useMarketPrices(
  onUpdate: (prices: MarketPriceData[]) => void,
  onOrderbookUpdate?: (orderbooks: OrderbookData[]) => void
) {
  const callbackRef = useRef(onUpdate);
  const orderbookCallbackRef = useRef(onOrderbookUpdate);
  useEffect(() => { callbackRef.current = onUpdate; });
  useEffect(() => { orderbookCallbackRef.current = onOrderbookUpdate; });

  const { accessToken } = useContext(AuthContext) || { accessToken: null };
  const isOnline = !!accessToken;

  useEffect(() => {
    if (isOnline) {
      // Online mode: connect to WebSocket backend
      const wsUrl = API_BASE_URL.replace(/^http/, 'ws') + `/ws?token=${accessToken}`;

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

      // Generate proper initial mock prices with all fields populated
      const initialPrices = generateAllMockPrices(knownSymbols);

      // Send initial mock data (with correct change_24h, high_24h, low_24h, volume_24h, sparkline)
      callbackRef.current(initialPrices);

      // Generate and send initial orderbooks
      if (orderbookCallbackRef.current) {
        const initialOrderbooks = knownSymbols.map(symbol => generateOrderbook(symbol));
        orderbookCallbackRef.current(initialOrderbooks);
      }

      // Set up interval to update prices AND orderbooks every second for realistic evolution
      const intervalId = setInterval(() => {
        const updatedPrices = knownSymbols.map(symbol => generateMockTick(symbol));
        callbackRef.current(updatedPrices);

        if (orderbookCallbackRef.current) {
          const updatedOrderbooks = knownSymbols.map(symbol => generateOrderbook(symbol));
          orderbookCallbackRef.current(updatedOrderbooks);
        }
      }, 1000);

      return () => {
        clearInterval(intervalId);
        // Reset mock prices state so it can be re-initialized when page remounts
        resetMockPrices();
      };
    }
  }, [isOnline]);
}