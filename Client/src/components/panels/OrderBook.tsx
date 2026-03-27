import { useMemo } from 'react';

export function OrderBook() {
  const asks = useMemo(() => Array.from({ length: 15 }).map((_, i) => ({
    price: 64230.50 + (14 - i) * 2.5,
    amount: (Math.random() * 2).toFixed(4),
    total: (Math.random() * 5 + 1).toFixed(4),
    depthWidth: Math.random() * 100
  })), []);

  const bids = useMemo(() => Array.from({ length: 15 }).map((_, i) => ({
    price: 64228.00 - i * 2.5,
    amount: (Math.random() * 2).toFixed(4),
    total: (Math.random() * 5 + 1).toFixed(4),
    depthWidth: Math.random() * 100
  })), []);

  return (
    <div className="flex flex-col h-full bg-panel w-full text-xs font-mono select-none">
      <div className="flex justify-between text-muted mb-2 px-1 text-[10px] font-sans font-medium uppercase tracking-wider">
        <span>Price (USD)</span>
        <span>Amount</span>
        <span>Total</span>
      </div>
      
      {/* Asks (Red) */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col justify-end">
        {asks.map((ask, i) => (
          <div key={i} className="flex justify-between relative py-0.5 hover:bg-panel cursor-pointer group transition-colors">
            <div className="absolute right-0 top-0 bottom-0 bg-red-500/10 transition-all group-hover:bg-red-500/20" style={{ width: `${ask.depthWidth}%` }} />
            <span className="text-down z-10 pl-1">{ask.price.toFixed(2)}</span>
            <span className="text-main z-10">{ask.amount}</span>
            <span className="text-muted z-10 pr-1">{ask.total}</span>
          </div>
        ))}
      </div>
      
      {/* Spread / Current Price */}
      <div className="py-2 flex items-center justify-between border-y border-main my-1 px-1 bg-transparent">
         <span className="text-up font-bold text-base flex items-center gap-1 font-mono">
            64,230.50 
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-up"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
         </span>
         <span className="text-muted line-through text-[10px] font-mono">64,231.00</span>
      </div>

      {/* Bids (Green) */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col justify-start">
        {bids.map((bid, i) => (
          <div key={i} className="flex justify-between relative py-0.5 hover:bg-panel cursor-pointer group transition-colors">
            <div className="absolute right-0 top-0 bottom-0 bg-green-500/10 transition-all group-hover:bg-green-500/20" style={{ width: `${bid.depthWidth}%` }} />
            <span className="text-up z-10 pl-1">{bid.price.toFixed(2)}</span>
            <span className="text-main z-10">{bid.amount}</span>
            <span className="text-muted z-10 pr-1">{bid.total}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
