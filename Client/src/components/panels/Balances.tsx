import { useState } from 'react';
import { Star } from 'lucide-react';

export function Balances() {
   const [tab, setTab] = useState<'balances' | 'watchlist'>('balances');
   const watchlist = [
      { symbol: 'ETH', name: 'Ethereum', price: '3,380.20', change: '+2.4%', up: true },
      { symbol: 'SOL', name: 'Solana', price: '148.45', change: '-1.2%', up: false }
   ];

   return (
      <div className="flex flex-col h-full bg-panel text-sm w-full font-sans">
         <div className="flex justify-between items-start px-3 py-2 border-b border-main shrink-0">
            <div className="flex flex-col">
               <span className="font-semibold text-sm text-main leading-tight mt-1">Balances & Portfolio</span>
               {tab === 'balances' && <span className="font-bold text-main font-mono text-xs mt-1">₹42,500.00</span>}
            </div>
            <div className="flex bg-main p-1 rounded-lg border border-main shrink-0">
               <button 
                  onClick={() => setTab('balances')}
                  className={`text-[10px] uppercase font-bold px-3 py-1.5 rounded-md transition-colors ${tab === 'balances' ? 'bg-panel shadow text-main' : 'text-muted hover:text-main'}`}
               >
                  Balances
               </button>
               <button 
                  onClick={() => setTab('watchlist')}
                  className={`text-[10px] uppercase font-bold px-3 py-1.5 rounded-md transition-colors ${tab === 'watchlist' ? 'bg-panel shadow text-main' : 'text-muted hover:text-main'}`}
               >
                  Watchlist
               </button>
            </div>
         </div>

         <div className="flex-1 p-2 flex flex-col min-h-0 overflow-hidden">
         <div className="flex flex-col gap-2 overflow-y-auto pr-1 no-scrollbar flex-1">
            {tab === 'balances' ? (
               <>
                  <div className="flex justify-between items-center bg-panel/50 p-2 rounded-lg border border-main/50 hover:border-white/20 transition-colors cursor-pointer group">
                     <div className="flex gap-2 items-center">
                        <div className="w-7 h-7 rounded-full bg-orange-500 flex items-center justify-center text-xs font-bold text-white shadow-md group-hover:scale-110 transition-transform">B</div>
                        <div className="flex flex-col leading-tight">
                           <span className="font-semibold text-main">BTC</span>
                           <span className="text-[10px] text-muted">Bitcoin</span>
                        </div>
                     </div>
                     <div className="flex flex-col items-end leading-tight">
                        <span className="font-semibold text-main font-mono">0.452</span>
                        <span className="text-[10px] text-muted font-mono">₹29,032.18</span>
                     </div>
                  </div>
                  <div className="flex justify-between items-center bg-panel/50 p-2 rounded-lg border border-main/50 hover:border-white/20 transition-colors cursor-pointer group">
                     <div className="flex gap-2 items-center">
                        <div className="w-7 h-7 rounded-full border-2 border-main flex items-center justify-center text-xs font-bold text-muted shadow-sm group-hover:scale-110 transition-transform">₹₹</div>
                        <div className="flex flex-col leading-tight">
                           <span className="font-semibold text-main">INR</span>
                           <span className="text-[10px] text-muted">Indian Rupee</span>
                        </div>
                     </div>
                     <div className="flex flex-col items-end leading-tight">
                        <span className="font-semibold text-main font-mono">13,467.82</span>
                        <span className="text-[10px] text-muted">Available</span>
                     </div>
                  </div>
               </>
            ) : (
               <>
                  {watchlist.map(w => (
                     <div key={w.symbol} className="flex justify-between items-center bg-panel/50 p-2 rounded-lg border border-main/50 hover:border-white/20 transition-colors cursor-pointer group">
                        <div className="flex gap-2 items-center">
                           <button className="text-yellow-400 hover:text-muted transition-colors"><Star size={14} fill="currentColor" /></button>
                           <div className="flex flex-col leading-tight">
                              <span className="font-semibold text-main">{w.symbol}</span>
                              <span className="text-[10px] text-muted">{w.name}</span>
                           </div>
                        </div>
                        <div className="flex flex-col items-end leading-tight">
                           <span className="font-semibold text-main font-mono">₹{w.price}</span>
                           <span className={`text-[10px] font-bold ₹{w.up ? 'text-up' : 'text-down'}`}>{w.change}</span>
                        </div>
                     </div>
                  ))}
               </>
            )}
         </div>
         </div>
      </div>
   );
}
