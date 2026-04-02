import { useState, useEffect } from 'react';
import { usePortfolio } from '../../hooks/usePortfolio'; 
import { useTradeWebSocket } from '../../hooks/useTrade'; 

interface OrderFormProps {
   symbol: string;
   currentPrice: number; // The static fallback from TradePage
}

export function OrderForm({ symbol, currentPrice }: OrderFormProps) {

   const [tab, setTab] = useState<'order' | 'pending'>('order');
   const [side, setSide] = useState<'buy' | 'sell'>('buy');
   const [type, setType] = useState<'limit' | 'market' | 'stop-limit'>('limit');
   
   const { cashBalance } = usePortfolio();

   
   // 2. CREATE A DYNAMIC STATE FOR THE LIVE MARKET PRICE
   const [liveMarketPrice, setLiveMarketPrice] = useState(currentPrice);

   const [price, setPrice] = useState(0); // Limit price
   const [amount, setAmount] = useState(0);
   const [isLoading, setIsLoading] = useState(false);
   const [apiError, setApiError] = useState<string | null>(null);

   const baseAsset = symbol ? symbol.split('/')[0] : 'Asset';

   // 3. LISTEN TO THE LIVE TICKS (Just like the ChartPanel does!)
   useTradeWebSocket(symbol, '1s', (liveData: any) => {
      if (liveData && liveData.close) {
         setLiveMarketPrice(liveData.close);
      }
   });

   // Reset inputs when switching assets
   useEffect(() => {
      setPrice(0);
      setAmount(0);
      setLiveMarketPrice(currentPrice); // Reset to static fallback immediately on switch
   }, [symbol, currentPrice]);

   // Smart Limit Price: Auto-fill once, but don't overwrite if user types
   useEffect(() => {
      if (price === 0 && liveMarketPrice > 0) {
         setPrice(liveMarketPrice);
      }
   }, [liveMarketPrice, price]);

   // 4. THE TOTAL USES THE LIVE TICKING PRICE
   const effectivePrice = type === 'market' ? liveMarketPrice : price;
   const total = amount * effectivePrice;

   const handleAmountChange = (val: number) => {
     setAmount(Math.floor(val));
   };

   const handleSubmit = async () => {
     if (amount <= 0) return;
     if (type === 'stop-limit') {
         setApiError("Stop-Limit orders are not supported yet.");
         return;
     }

     setIsLoading(true);
     setApiError(null);

     const payload = {
       symbol: symbol, 
       type: type.toUpperCase(),
       side: side.toUpperCase(), 
       price: effectivePrice, 
       quantity: amount, 
     };

     try {
       const token = localStorage.getItem('access_token'); 

       if (!token) {
          setApiError("Authentication Error: No token found. Please log in again.");
          setIsLoading(false);
          return;
       }

       const response = await fetch('http://localhost:8080/v1/orders', {
         method: 'POST',
         headers: {
           'Content-Type': 'application/json',
           'Authorization': `Bearer ${token}` 
         },
         body: JSON.stringify(payload)
       });

       const text = await response.text();
       let data: any = {};
       
       if (text) {
         try {
           data = JSON.parse(text);
         } catch (e) {
           throw new Error(`Server error: Unexpected response format (Status ${response.status})`);
         }
       }

       if (!response.ok) {
         throw new Error(data.error || data.message || `Failed to place order (HTTP ${response.status})`);
       }

       alert(`${side.toUpperCase()} Order Queued: ${data.data?.order_id || 'Success'}`);
       setAmount(0);

     } catch (err: any) {
       console.error('Order placement error:', err);
       setApiError(err.message);
     } finally {
       setIsLoading(false);
     }
   };

   return (
      <div className="flex bg-panel flex-col h-full text-sm w-full font-sans">
         <div className="flex justify-start items-center px-3 py-2 border-b border-main shrink-0 z-10">
            <div className="flex bg-main p-1 rounded-lg border border-main shrink-0">
               <button onClick={() => setTab('order')} className={`text-[10px] uppercase font-bold px-3 py-1.5 rounded-md transition-colors ${tab === 'order' ? 'bg-panel shadow text-main' : 'text-muted hover:text-main'}`}>Place Order</button>
               <button onClick={() => setTab('pending')} className={`text-[10px] uppercase font-bold px-3 py-1.5 rounded-md transition-colors ${tab === 'pending' ? 'bg-panel shadow text-main' : 'text-muted hover:text-main'}`}>Pending Orders</button>
            </div>
         </div>

         <div className="flex-1 p-3 flex flex-col min-h-0 overflow-y-auto no-scrollbar">
            {tab === 'order' ? (
               <div className="flex flex-col gap-2 flex-1 min-h-0">
                  <div className="flex bg-panel/50 p-1 rounded-lg shrink-0">
                     <button onClick={() => setSide('buy')} className={`flex-1 py-1 rounded-md text-center text-sm font-bold transition-all duration-200 ${side === 'buy' ? 'bg-up text-white shadow' : 'text-muted hover:text-main'}`}>Buy</button>
                     <button onClick={() => setSide('sell')} className={`flex-1 py-1 rounded-md text-center text-sm font-bold transition-all duration-200 ${side === 'sell' ? 'bg-down text-white shadow' : 'text-muted hover:text-main'}`}>Sell</button>
                  </div>

                  <div className="flex gap-4 border-b border-main uppercase tracking-wide text-[10px] pb-2 mb-3 shrink-0">
                     {(['limit', 'market', 'stop-limit'] as const).map(t => (
                       <button
                         key={t}
                         onClick={() => {
                            setType(t);
                            if (apiError) setApiError(null);
                         }}
                         className={`font-semibold transition-colors uppercase tracking-widest ${type === t ? 'text-main' : 'text-muted hover:text-main'}`}
                       >{t}</button>
                     ))}
                  </div>

                  <div className="flex flex-col gap-2.5 flex-1 min-h-0">
                     {apiError && (
                        <div className="bg-down/20 border border-down/50 text-down text-xs p-2 rounded shrink-0 font-medium">
                           {apiError}
                        </div>
                     )}

                     <div className="flex flex-col gap-1.5 shrink-0">
                        <label className="text-[10px] uppercase tracking-wide font-medium text-muted">
                          {type === 'market' ? 'Market Price' : 'Price'}
                        </label>
                        <div className="flex bg-panel/50 border border-main/50 rounded-md overflow-hidden focus-within:border-white focus-within:ring-1 focus-within:ring-white/20 transition-all">
                           <input
                             type="number"
                             step="0.01"
                             // 5. STREAMS liveMarketPrice directly!
                             value={type === 'market' ? liveMarketPrice : (price || '')}
                             onChange={e => setPrice(Number(e.target.value))}
                             disabled={type === 'market'}
                             className="bg-transparent flex-1 p-2.5 outline-none text-main min-w-0 disabled:opacity-50 font-mono text-sm"
                           />
                           <span className="px-3 text-muted bg-panel/80 border-l border-main text-xs flex items-center font-medium">INR</span>
                        </div>
                     </div>

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
                           <span className="px-3 text-muted bg-panel/80 border-l border-main text-xs flex items-center font-medium">{baseAsset}</span>
                        </div>
                     </div>

                     <div className="flex justify-between text-xs text-muted shrink-0">
                       <span>Available Balance</span>
                       <span className="font-mono text-main">₹{(cashBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                     </div>

                     <div className="mt-auto flex justify-between text-xs pt-2 border-t border-main mb-2 shrink-0">
                        <span className="text-muted font-medium">Total</span>
                        {/* 6. TOTAL TICKING IN REAL-TIME */}
                        <span className="text-main font-bold font-mono">{total > 0 ? `₹${total.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '₹0.00'}</span>
                     </div>

                     <button
                       onClick={handleSubmit}
                       disabled={amount <= 0 || isLoading || type === 'stop-limit'}
                       className={`w-full py-2.5 rounded-lg font-bold text-white transition-all transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed ${side === 'buy' ? 'bg-up hover:brightness-110' : 'bg-down hover:brightness-110'} shadow-lg shrink-0 text-sm flex items-center justify-center gap-2`}
                     >
                        {isLoading ? (
                           <span className="animate-pulse">Processing...</span>
                        ) : (
                           <>
                              {side === 'buy' ? 'Buy' : 'Sell'} {baseAsset}
                              {type !== 'market' && price > 0 && ` @ ₹${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                           </>
                        )}
                     </button>
                  </div>
               </div>
            ) : (
               <div className="flex-1 flex flex-col overflow-hidden">
                 <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col gap-2">
                    <div className="text-center text-muted text-xs py-4">No pending orders</div>
                 </div>
               </div>
            )}
         </div>
      </div>
   );
}