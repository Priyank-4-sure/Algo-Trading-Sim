import { useEffect, useRef, useState } from "react";
import { API_BASE_URL } from "../config";
import { generateMockCandles, MockCandleData } from "../data/mockCandleGenerator";

export function useTradeWebSocket(
    symbol: string,
    timeframe: string,
    onNewData: (data: any, isHistorical: boolean) => void
) {
    // Keep the callback ref fresh without restarting the WebSocket
    const callbackRef = useRef(onNewData);
    useEffect(() => { callbackRef.current = onNewData; });

    const [isOffline, setIsOffline] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem('access_token');
        const isOnline = !!token;

        if (isOnline) {
            // Online mode: connect to WebSocket backend
            const topic = `candles:${symbol}:${timeframe}`;
            const wsUrl = API_BASE_URL.replace(/^http/, 'ws') + `/ws?token=${token}`;
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
            }

            return () => {
                clearTimeout(reconnectTimeout);
                if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
                    ws.close(1000, 'Component unmounted');
                }
            };
        } else {
            // Offline/fallback mode: use mock candle data
            console.log(`[${symbol}] Using offline mock data mode`);
            setIsOffline(true);

            // Generate initial historical candles
            const initialCandles = generateMockCandles(symbol, timeframe, 500);
            callbackRef.current(initialCandles, true);

            // Set up interval to push new live candles every second (for 1s) or 5 seconds (for 5s)
            const intervalMs = timeframe === '5s' ? 5000 : 1000;
            const intervalId = setInterval(() => {
                const newCandle = generateMockCandles(symbol, timeframe, 1)[0];
                callbackRef.current(newCandle, false);
            }, intervalMs);

            return () => {
                clearInterval(intervalId);
            };
        }
    }, [symbol, timeframe]);

    return { isOffline };
}
