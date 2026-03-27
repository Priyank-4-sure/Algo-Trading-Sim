import { useState } from 'react';

interface OrderFormProps {
   compact?: boolean;
}

export function OrderForm({ compact = false }: OrderFormProps) {
   const [side, setSide] = useState<'buy' | 'sell'>('buy');
   const [type, setType] = useState<'limit' | 'market' | 'stop-limit'>('limit');
   const [price, setPrice] = useState(64230.50);
   const [stopPrice, setStopPrice] = useState(63000.00);
   const [amount, setAmount] = useState(0);
   const [sliderValue, setSliderValue] = useState(0);

   const availableBalance = 13467.82;
   const marketPrice = 64230.50;
   const effectivePrice = type === 'market' ? marketPrice : price;
   const total = amount * effectivePrice;

   const handleSliderChange = (val: number) => {
     setSliderValue(val);
     const maxAmount = availableBalance / effectivePrice;
     setAmount(Number((maxAmount * val / 100).toFixed(6)));
   };

   const handleAmountChange = (val: number) => {
     setAmount(val);
     const maxAmount = availableBalance / effectivePrice;
     setSliderValue(Math.min(100, Number(((val / maxAmount) * 100).toFixed(0))));
   };

   const handleSubmit = () => {
     if (amount <= 0) return;
     const order = {
       side, type, amount,
       price: type === 'market' ? marketPrice : price,
       ...(type === 'stop-limit' ? { stopPrice } : {}),
       total: amount * (type === 'market' ? marketPrice : price),
     };
     console.log('Order placed:', order);
     alert(`${side.toUpperCase()} ${amount} BTC @ ${type === 'market' ? 'Market' : `$${order.price.toLocaleString()}`}\nTotal: $${order.total.toLocaleString()}`);
   };

   return (
      <div className="flex bg-panel flex-col h-full text-sm w-full font-sans">
         {/* Buy / Sell Tabs */}
         <div className="flex bg-panel/50 p-1 rounded-lg mb-3 shrink-0">
            <button
               onClick={() => setSide('buy')}
               className={`flex-1 py-1 rounded-md text-center text-sm font-bold transition-all duration-200 ${side === 'buy' ? 'bg-up text-white shadow' : 'text-muted hover:text-main'}`}
            >Buy</button>
            <button
               onClick={() => setSide('sell')}
               className={`flex-1 py-1 rounded-md text-center text-sm font-bold transition-all duration-200 ${side === 'sell' ? 'bg-down text-white shadow' : 'text-muted hover:text-main'}`}
            >Sell</button>
         </div>

         {/* Order Type Tabs */}
         <div className="flex gap-4 border-b border-main uppercase tracking-wide text-[10px] pb-2 mb-3 shrink-0">
            {(['limit', 'market', 'stop-limit'] as const).map(t => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`font-semibold transition-colors uppercase tracking-widest ${type === t ? 'text-main' : 'text-muted hover:text-main'}`}
              >{t}</button>
            ))}
         </div>

         {/* Form Fields */}
         <div className="flex flex-col gap-2.5 flex-1 min-h-0">
            {/* Stop Price (Stop-Limit only) */}
            {type === 'stop-limit' && (
              <div className="flex flex-col gap-1.5 shrink-0">
                <label className="text-[10px] uppercase tracking-wide font-medium text-muted">Stop Price (USD)</label>
                <div className="flex bg-panel/50 border border-main/50 rounded-md overflow-hidden focus-within:border-white focus-within:ring-1 focus-within:ring-white/20 transition-all">
                  <input
                    type="number"
                    value={stopPrice}
                    onChange={e => setStopPrice(Number(e.target.value))}
                    className="bg-transparent flex-1 p-2.5 outline-none text-main min-w-0 font-mono text-sm"
                  />
                  <span className="px-3 text-muted bg-panel/80 border-l border-main text-xs flex items-center font-medium">USD</span>
                </div>
              </div>
            )}

            {/* Limit Price */}
            <div className="flex flex-col gap-1.5 shrink-0">
               <label className="text-[10px] uppercase tracking-wide font-medium text-muted">
                 {type === 'market' ? 'Market Price (USD)' : 'Price (USD)'}
               </label>
               <div className="flex bg-panel/50 border border-main/50 rounded-md overflow-hidden focus-within:border-white focus-within:ring-1 focus-within:ring-white/20 transition-all">
                  <input
                    type="number"
                    value={type === 'market' ? marketPrice : price}
                    onChange={e => setPrice(Number(e.target.value))}
                    disabled={type === 'market'}
                    className="bg-transparent flex-1 p-2.5 outline-none text-main min-w-0 disabled:opacity-50 font-mono text-sm"
                  />
                  <span className="px-3 text-muted bg-panel/80 border-l border-main text-xs flex items-center font-medium">USD</span>
               </div>
            </div>

            {/* Amount */}
            <div className="flex flex-col gap-1.5 shrink-0">
               <label className="text-[10px] uppercase tracking-wide font-medium text-muted">Amount (BTC)</label>
               <div className="flex bg-panel/50 border border-main/50 rounded-md overflow-hidden focus-within:border-white focus-within:ring-1 focus-within:ring-white/20 transition-all">
                  <input
                    type="number"
                    value={amount || ''}
                    onChange={e => handleAmountChange(Number(e.target.value))}
                    placeholder="0.00"
                    className="bg-transparent flex-1 p-2.5 outline-none text-main min-w-0 font-mono text-sm"
                  />
                  <span className="px-3 text-muted bg-panel/80 border-l border-main text-xs flex items-center font-medium">BTC</span>
               </div>
            </div>

            {/* Percentage Slider */}
            <div className={`pt-2 pb-2 shrink-0 ${compact ? 'hidden' : ''}`}>
               <input
                 type="range"
                 min="0"
                 max="100"
                 value={sliderValue}
                 onChange={e => handleSliderChange(Number(e.target.value))}
                 className="w-full accent-white cursor-pointer h-1 bg-trading-border/30 rounded-lg appearance-none"
               />
               <div className="flex justify-between text-[10px] text-muted font-medium mt-1 font-mono">
                  {[0, 25, 50, 75, 100].map(pct => (
                    <button
                      key={pct}
                      onClick={() => handleSliderChange(pct)}
                      className={`hover:text-main transition-colors ${sliderValue === pct ? 'text-main font-bold' : ''}`}
                    >{pct}%</button>
                  ))}
               </div>
            </div>

            {/* Available Balance */}
            <div className="flex justify-between text-xs text-muted shrink-0">
              <span>Available</span>
              <span className="font-mono text-main">${availableBalance.toLocaleString()}</span>
            </div>

            {/* Total */}
            <div className="mt-auto flex justify-between text-xs pt-2 border-t border-main mb-2 shrink-0">
               <span className="text-muted font-medium">Total</span>
               <span className="text-main font-bold font-mono">{total > 0 ? `$${total.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '0.00 USD'}</span>
            </div>

            <button
              onClick={handleSubmit}
              disabled={amount <= 0}
              className={`w-full py-2.5 rounded-lg font-bold text-white transition-all transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed ${side === 'buy' ? 'bg-up hover:brightness-110' : 'bg-down hover:brightness-110'} shadow-lg shrink-0 text-sm`}
            >
               {side === 'buy' ? 'Buy' : 'Sell'} BTC
               {type !== 'market' && ` @ $${price.toLocaleString()}`}
            </button>
         </div>
      </div>
   );
}
