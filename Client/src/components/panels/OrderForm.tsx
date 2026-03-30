import { useState } from 'react';

export function OrderForm() {
   const [tab, setTab] = useState<'order' | 'pending'>('order');
   const [side, setSide] = useState<'buy' | 'sell'>('buy');
   const [type, setType] = useState<'limit' | 'market' | 'stop-limit'>('limit');
   const [price, setPrice] = useState(64230.50);
   const [stopPrice, setStopPrice] = useState(63000.00);
   const [amount, setAmount] = useState(0);

   const pendingOrders = [
      { id: 1, symbol: 'BTC/USD', side: 'Buy', amount: 0.15, type: 'Limit', price: 61200.00 },
      { id: 2, symbol: 'ETH/USD', side: 'Sell', amount: 2.5, type: 'Stop-Limit', price: 3500.00 }
   ];

   const availableBalance = 13467.82;
   const marketPrice = 64230.50;
   const effectivePrice = type === 'market' ? marketPrice : price;
   const total = amount * effectivePrice;


   const handleAmountChange = (val: number) => {
     setAmount(Math.floor(val));
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
         {/* Navigator Header */}
         <div className="flex justify-start items-center px-3 py-2 border-b border-main shrink-0 z-10">
            <div className="flex bg-main p-1 rounded-lg border border-main shrink-0">
               <button 
                  onClick={() => setTab('order')}
                  className={`text-[10px] uppercase font-bold px-3 py-1.5 rounded-md transition-colors ${tab === 'order' ? 'bg-panel shadow text-main' : 'text-muted hover:text-main'}`}
               >
                  Place Order
               </button>
               <button 
                  onClick={() => setTab('pending')}
                  className={`text-[10px] uppercase font-bold px-3 py-1.5 rounded-md transition-colors ${tab === 'pending' ? 'bg-panel shadow text-main' : 'text-muted hover:text-main'}`}
               >
                  Pending Orders
               </button>
            </div>
         </div>

         <div className="flex-1 p-3 flex flex-col min-h-0 overflow-y-auto no-scrollbar">
            {tab === 'order' ? (
               <div className="flex flex-col gap-2 flex-1 min-h-0">
                  {/* Buy / Sell Tabs */}
                  <div className="flex bg-panel/50 p-1 rounded-lg shrink-0">
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
                <label className="text-[10px] uppercase tracking-wide font-medium text-muted">Stop Price</label>
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
                 {type === 'market' ? 'Market Price' : 'Price'}
               </label>
               <div className="flex bg-panel/50 border border-main/50 rounded-md overflow-hidden focus-within:border-white focus-within:ring-1 focus-within:ring-white/20 transition-all">
                  <input
                    type="number"
                    step="0.01"
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
               <label className="text-[10px] uppercase tracking-wide font-medium text-muted">Quantity</label>
               <div className="flex bg-panel/50 border border-main/50 rounded-md overflow-hidden focus-within:border-white focus-within:ring-1 focus-within:ring-white/20 transition-all">
                  <input
                    type="number"
                    step="1"
                    value={amount || ''}
                    onChange={e => handleAmountChange(Number(e.target.value))}
                    placeholder="0"
                    className="bg-transparent flex-1 p-2.5 outline-none text-main min-w-0 font-mono text-sm"
                  />
                  <span className="px-3 text-muted bg-panel/80 border-l border-main text-xs flex items-center font-medium">QTY</span>
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
                  {type !== 'market' && ` @ $${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
               </button>
               </div>
               </div>
            ) : (
               <div className="flex-1 flex flex-col overflow-hidden">
                 <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col gap-2">
                   {pendingOrders.map(order => (
                      <div key={order.id} className="flex flex-col bg-panel/50 p-2 rounded-lg border border-main/50 hover:border-white/20 transition-colors group">
                         <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-2">
                               <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${order.side === 'Buy' ? 'bg-up/20 text-up' : 'bg-down/20 text-down'}`}>{order.side}</span>
                               <span className="font-bold text-main text-xs">{order.symbol}</span>
                            </div>
                            <span className="text-[10px] uppercase font-bold text-muted border border-main/50 px-1.5 rounded">{order.type}</span>
                         </div>
                         <div className="flex justify-between items-end">
                            <div className="flex flex-col">
                               <span className="text-[10px] text-muted leading-tight">Amount</span>
                               <span className="font-mono text-main font-semibold text-xs">{order.amount}</span>
                            </div>
                            <div className="flex flex-col items-end">
                               <span className="text-[10px] text-muted leading-tight">Price</span>
                               <span className="font-mono text-main font-semibold text-xs">${order.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                         </div>
                         <button className="mt-2 text-[10px] w-full text-center py-1 text-muted hover:text-down hover:bg-down/10 rounded transition-colors uppercase font-bold tracking-wider">
                            Cancel Order
                         </button>
                      </div>
                   ))}
                 </div>
               </div>
            )}
         </div>
      </div>
   );
}
