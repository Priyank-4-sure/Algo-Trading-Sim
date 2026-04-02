import { useEffect, useRef } from "react";

export function useTradeWebSocket(
    symbol: string,
    timeframe: string,
    onNewData: (data: any, isHistorical: boolean) => void
) {
    // Keep the callback ref fresh without restarting the WebSocket
    const callbackRef = useRef(onNewData);
    useEffect(() => { callbackRef.current = onNewData; });

    useEffect(() => {
        const token = localStorage.getItem('access_token');
        if (!token) return;

        const topic = `candles:${symbol}:${timeframe}`;
        const wsUrl = `ws://localhost:8080/v1/ws?token=${token}`;
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            console.log(`Chart WS Connected for ${symbol} @ ${timeframe}`);
            ws.send(JSON.stringify({ action: "subscribe", topic }));
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

        return () => {
            if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
                ws.close();
                console.log(`Chart WS Closed for ${symbol} @ ${timeframe}`);
            }
        };
    }, [symbol, timeframe]);
}
