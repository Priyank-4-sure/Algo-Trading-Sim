import { useState, useEffect } from 'react';
import { useWebSocket } from '../../contexts/WebSocketContext';

interface LOBPriceLevel {
  price: number;
  amount: number;
  total: number;
  depthWidth: number;
}

export function OrderBook() {
  const { lastMessage, selectedSymbol } = useWebSocket();
  const [asks, setAsks] = useState<LOBPriceLevel[]>([]);
  const [bids, setBids] = useState<LOBPriceLevel[]>([]);
  const [spread, setSpread] = useState({ bestAsk: 0, bestBid: 0 });

  useEffect(() => {
    if (!lastMessage) return;
    if (lastMessage.action !== 'lob_update') return;

    const payload = lastMessage.payload;
    if (!payload || payload.symbol !== selectedSymbol) return;

    // Process Asks — calculate depth percentages
    const rawAsks: { price: number; amount: number; total: number }[] = payload.asks || [];
    const rawBids: { price: number; amount: number; total: number }[] = payload.bids || [];

    const maxAskTotal = rawAsks.length > 0 ? rawAsks[rawAsks.length - 1].total : 1;
    const maxBidTotal = rawBids.length > 0 ? rawBids[rawBids.length - 1].total : 1;

    const processedAsks: LOBPriceLevel[] = rawAsks.map(a => ({
      price: a.price,
      amount: a.amount,
      total: a.total,
      depthWidth: (a.total / maxAskTotal) * 100,
    }));

    const processedBids: LOBPriceLevel[] = rawBids.map(b => ({
      price: b.price,
      amount: b.amount,
      total: b.total,
      depthWidth: (b.total / maxBidTotal) * 100,
    }));

    // Asks are sorted lowest-first from the engine, reverse for display (highest at top)
    setAsks([...processedAsks].reverse());
    setBids(processedBids);

    // Update spread
    if (rawAsks.length > 0 && rawBids.length > 0) {
      setSpread({
        bestAsk: rawAsks[0].price,
        bestBid: rawBids[0].price,
      });
    }
  }, [lastMessage]);

  const midPrice = spread.bestAsk > 0 && spread.bestBid > 0
    ? ((spread.bestAsk + spread.bestBid) / 2)
    : 0;

  return (
    <div className="flex flex-col h-full bg-panel w-full text-xs font-mono select-none">
      <div className="flex justify-between text-muted mb-2 px-1 text-[10px] font-sans font-medium uppercase tracking-wider">
        <span>Price (USD)</span>
        <span>Amount</span>
        <span>Total</span>
      </div>
      
      {/* Asks (Red) */}
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col justify-end no-scrollbar">
        {asks.length > 0 ? asks.map((ask, i) => (
          <div key={i} className="flex justify-between relative py-0.5 hover:bg-panel cursor-pointer group transition-colors">
            <div className="absolute right-0 top-0 bottom-0 bg-red-500/10 transition-all group-hover:bg-red-500/20" style={{ width: `${ask.depthWidth}%` }} />
            <span className="text-down z-10 pl-1">{ask.price.toFixed(2)}</span>
            <span className="text-main z-10">{ask.amount.toFixed(4)}</span>
            <span className="text-muted z-10 pr-1">{ask.total.toFixed(4)}</span>
          </div>
        )) : (
          <div className="flex items-center justify-center text-muted text-xs h-full">Waiting for data...</div>
        )}
      </div>
      
      {/* Spread / Current Price */}
      <div className="py-2 flex items-center justify-between border-y border-main my-1 px-1 bg-transparent">
         <span className="text-up font-bold text-base flex items-center gap-1 font-mono">
            {midPrice > 0 ? midPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
            {midPrice > 0 && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-up"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
            )}
         </span>
         <span className="text-muted text-[10px] font-mono">
            {spread.bestAsk > 0 ? `Spread: ${(spread.bestAsk - spread.bestBid).toFixed(2)}` : '—'}
         </span>
      </div>

      {/* Bids (Green) */}
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col justify-start no-scrollbar">
        {bids.length > 0 ? bids.map((bid, i) => (
          <div key={i} className="flex justify-between relative py-0.5 hover:bg-panel cursor-pointer group transition-colors">
            <div className="absolute right-0 top-0 bottom-0 bg-green-500/10 transition-all group-hover:bg-green-500/20" style={{ width: `${bid.depthWidth}%` }} />
            <span className="text-up z-10 pl-1">{bid.price.toFixed(2)}</span>
            <span className="text-main z-10">{bid.amount.toFixed(4)}</span>
            <span className="text-muted z-10 pr-1">{bid.total.toFixed(4)}</span>
          </div>
        )) : (
          <div className="flex items-center justify-center text-muted text-xs h-full">Waiting for data...</div>
        )}
      </div>
    </div>
  );
}
