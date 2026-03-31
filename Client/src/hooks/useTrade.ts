import { useEffect, useRef } from "react";

// We now accept a direct function to call when data arrives
export function useTradeWebSocket(symbol: string, onNewData: (data: any) => void) {
    // This keeps the function fresh without restarting the WebSocket
    const callbackRef = useRef(onNewData);
    useEffect(() => { callbackRef.current = onNewData; });

    useEffect(() => {
        const token = localStorage.getItem('access_token');
        if (!token) return;

        const wsUrl = `ws://localhost:8080/v1/ws?token=${token}`;
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            console.log(`Chart WS Connected for ${symbol}`);
            ws.send(JSON.stringify({ action: "subscribe", topic: `candles:${symbol}` }));
        };

        ws.onmessage = (event) => {
            try {
                const payload = JSON.parse(event.data);
                console.log("Chart WS Data Received:", payload);
                
                if (payload.data) {
                    // Send just the inner object (open, high, low, close, bucket_time) to the chart
                    callbackRef.current(payload.data); 
                }
                
            } catch (err) {
                console.error('Failed to parse chart WS message', err);
            }
        };

        return () => {
            if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
                ws.close();
                console.log(`Chart WS Closed for ${symbol}`);
            }
        };
    }, [symbol]); 
}