import { useEffect, useRef, useState, useContext } from "react";
import { API_BASE_URL } from "../config";
import { generateOrderbook, OrderbookData, subscribeToOrderbook } from "../data/mockPriceGenerator";
import { AuthContext } from "../context/AuthContext";

export interface PriceLevel {
  price: number;
  quantity: number;
}

export interface LOBSnapshot {
  symbol: string;
  bids: PriceLevel[];
  asks: PriceLevel[];
  mid_price: number;
}

export function useOrderBook(symbol: string) {
  const [snapshot, setSnapshot] = useState<LOBSnapshot | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const { accessToken } = useContext(AuthContext) || { accessToken: null };

  useEffect(() => {
    if (!symbol) return;

    // Check if we're in online mode (has auth token)
    const isOnline = !!accessToken;

    if (isOnline) {
      // Online mode: connect to WebSocket backend
      const wsUrl = API_BASE_URL.replace(/^http/, 'ws') + `/ws?token=${accessToken}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log(`OrderBook WS connected for ${symbol}`);
        ws.send(JSON.stringify({ action: "subscribe", topic: `orderbook:${symbol}` }));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.topic === `orderbook:${symbol}` && msg.data) {
            setSnapshot(msg.data as LOBSnapshot);
          }
        } catch (err) {
          console.error("Failed to parse orderbook WS message", err);
        }
      };

      return () => {
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close();
          console.log(`OrderBook WS closed for ${symbol}`);
        }
        setSnapshot(null);
      };
    } else {
      // Offline/fallback mode: use generated mock orderbook data
      console.log(`[${symbol}] Using offline mock orderbook mode`);

      // Generate and persist orderbook data
      const obData = generateOrderbook(symbol);

      // Convert to snapshot format
      const obSnapshot: LOBSnapshot = {
        symbol: obData.symbol,
        bids: obData.bids.map(b => ({
          price: b.price,
          quantity: b.quantity
        })),
        asks: obData.asks.map(a => ({
          price: a.price,
          quantity: a.quantity
        })),
        mid_price: obData.midPrice
      };

      setSnapshot(obSnapshot);

      // Subscribe to orderbook updates when price changes
      const unsubscribe = subscribeToOrderbook(
        symbol,
        (ob: OrderbookData) => {
          const obSnapshot: LOBSnapshot = {
            symbol: ob.symbol,
            bids: ob.bids.map(b => ({
              price: b.price,
              quantity: b.quantity
            })),
            asks: ob.asks.map(a => ({
              price: a.price,
              quantity: a.quantity
            })),
            mid_price: ob.midPrice
          };
          setSnapshot(obSnapshot);
        }
      );

      return () => {
        unsubscribe();
        setSnapshot(null);
      };
    }
  }, [symbol, accessToken]);

  return snapshot;
}
