import { useEffect, useRef, useState, useContext } from "react";
import { API_BASE_URL } from "../config";
import {
  generateMockCandles,
  subscribeToPrice,
  initCandleState,
  getStateKey,
  candleStates,
  validateCandleTimeframes,
  generateCandleAtTime,
  generateLiveCandleUpdate,
} from "../data/mockPriceGenerator";
import { retrieveTickHistory } from "../data/mockStorage";
import { AuthContext } from "../context/AuthContext";

export function useTradeWebSocket(
    symbol: string,
    timeframe: string,
    onNewData: (data: any, isHistorical: boolean) => void
) {
    // Keep the callback ref fresh without restarting the WebSocket
    const callbackRef = useRef(onNewData);
    useEffect(() => { callbackRef.current = onNewData; });

    // Add a debug log to track when component mounts and price updates
    useEffect(() => {
        console.log(`[${symbol}:${timeframe}] useTradeWebSocket mounted, initializing...`);
        return () => {
            console.log(`[${symbol}:${timeframe}] useTradeWebSocket unmounting`);
        };
    }, [symbol, timeframe]);

    const [isOffline, setIsOffline] = useState(false);
    const { accessToken } = useContext(AuthContext) || { accessToken: null };

    useEffect(() => {
        // Determine online/offline mode from AuthContext
        const isOnline = !!accessToken;

        if (isOnline) {
            // Online mode: connect to WebSocket backend
            const topic = `candles:${symbol}:${timeframe}`;
            const wsUrl = API_BASE_URL.replace(/^http/, 'ws') + `/ws?token=${accessToken}`;
            let ws: WebSocket | null = new WebSocket(wsUrl);
            let reconnectTimeout: ReturnType<typeof setTimeout>;
            let reconnectAttempts = 0;
            const maxReconnectAttempts = 3;

            const connect = () => {
                if (!ws || ws.readyState === WebSocket.CLOSED) {
                    ws = new WebSocket(wsUrl);
                    reconnectAttempts = 0;
                }
            };

            if (ws) {
                ws.onopen = () => {
                    console.log(`Chart WS Connected for ${symbol} @ ${timeframe}`);
                    ws!.send(JSON.stringify({ action: "subscribe", topic }));
                    setIsOffline(false);
                    reconnectAttempts = 0;
                };

                ws.onmessage = (event) => {
                    try {
                        const payload = JSON.parse(event.data);
                        if (payload.data) {
                            const isHistorical = payload.topic === `${topic}:historical`;
                            callbackRef.current(payload.data, isHistorical);
                        }
                    } catch (err) {
                        console.error('Failed to parse chart WS message', err);
                    }
                };

                ws.onerror = (error) => {
                    console.error('Chart WS Error:', error);
                };
            }

            ws.onclose = (event) => {
                console.log(`Chart WS Closed for ${symbol} @ ${timeframe} (code: ${event.code})`);

                // Only attempt reconnect if not a clean close and under max attempts
                if (event.code !== 1000 && reconnectAttempts < maxReconnectAttempts) {
                    reconnectAttempts++;
                    reconnectTimeout = setTimeout(() => {
                        console.log(`Reconnecting... attempt ${reconnectAttempts}/${maxReconnectAttempts}`);
                        connect();
                    }, 2000 * reconnectAttempts);
                } else if (reconnectAttempts >= maxReconnectAttempts) {
                    console.log('Max reconnection attempts reached, switching to offline mode');
                    setIsOffline(true);
                }
            };

            return () => {
                clearTimeout(reconnectTimeout);
                if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
                    ws.close(1000, 'Component unmounted');
                }
            };
        } else {
            // Offline/fallback mode: use mock candle data
            console.log(`[${symbol}] Using offline mock data mode for ${timeframe}`);
            setIsOffline(true);

            // Initialize candle state and log initial state for debugging
            initCandleState(symbol, timeframe);
            const initialState = candleStates[getStateKey(symbol, timeframe)];
            console.log(`[${symbol}:${timeframe}] Initial candle state:`, {
                lastUpdateTime: initialState?.lastUpdateTime,
                currentPrice: initialState?.currentPrice,
                intervalMs: timeframe === '5s' ? 5000 : 1000,
                nextExpectedTime: initialState?.lastUpdateTime + (timeframe === '5s' ? 5000 : 1000),
                candlesCount: initialState?.candles?.length || 0
            });

            // Try to load persisted tick history first
            const savedTicks = retrieveTickHistory(symbol, timeframe);

            if (savedTicks && savedTicks.length > 0) {
                console.log(`[${symbol}:${timeframe}] Loaded ${savedTicks.length} persisted candles`);

                // Validate loaded candles
                const validation = validateCandleTimeframes(
                    savedTicks.map(t => ({
                        bucket_time: t.bucket_time,
                        open: t.open,
                        high: t.high,
                        low: t.low,
                        close: t.close,
                        volume: t.volume,
                    })),
                    timeframe
                );

                if (!validation.isValid) {
                    console.warn(`[${symbol}:${timeframe}] Validation errors:`, validation.errors);
                }
                if (validation.warnings.length > 0) {
                    console.warn(`[${symbol}:${timeframe}] Validation warnings:`, validation.warnings);
                }

                // Send persisted history as historical data
                callbackRef.current(savedTicks, true);
            } else {
                // Generate initial candles if no history exists
                const initialCandles = generateMockCandles(symbol, timeframe, 500);
                callbackRef.current(initialCandles, true);
            }

// Subscribe to live price updates for in-progress candle wick movement
            const unsubscribe = subscribeToPrice(symbol, (price: number) => {
                // Update the candle state with new price
                const key = getStateKey(symbol, timeframe);
                const state = candleStates[key];
                const intervalMs = timeframe === '5s' ? 5000 : 1000;
                if (state) {
                    state.currentPrice = price;

                    // Generate a live candle update for in-progress candle wicks
                    const liveUpdate = generateLiveCandleUpdate(symbol, timeframe);
                    if (liveUpdate) {
                        // Send the live update for real-time wick display
                        callbackRef.current(liveUpdate, false);
                    }

                    // For both timeframes, check if enough time has passed to generate a new candle
                    const now = Date.now();
                    const timeSinceLastCandle = now - state.lastUpdateTime;
                    const intervalsPassed = Math.floor(timeSinceLastCandle / intervalMs);

                    if (intervalsPassed >= 1) {
                        // Generate a new candle at the interval boundary
                        const newCandle = generateCandleAtTime(symbol, timeframe);
                        // The new candle becomes the current price state
                        state.currentPrice = newCandle.close;
                        state.lastUpdateTime = newCandle.bucket_time ? new Date(newCandle.bucket_time).getTime() : now;
                        callbackRef.current(newCandle, false);
                    }
                }
            });

            // Clean up subscription on unmount
            return () => {
                unsubscribe();
            };
        }
    }, [symbol, timeframe, accessToken]);

    return { isOffline };
}