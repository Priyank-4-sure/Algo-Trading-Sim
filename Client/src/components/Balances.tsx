export function Balances() {
   return (
      <div className="flex flex-col h-full bg-panel text-sm w-full">
         <div className="flex justify-between mb-3 items-center">
            <span className="text-muted text-xs uppercase font-semibold tracking-wider">Total Balance</span>
            <span className="font-bold text-main">$42,500.00</span>
         </div>
         <div className="flex flex-col gap-2 overflow-y-auto pr-1">
            <div className="flex justify-between items-center bg-panel/50 p-2 rounded-lg border border-main/50 hover:border-white/20 transition-colors cursor-pointer group">
               <div className="flex gap-2 items-center">
                  <div className="w-7 h-7 rounded-full bg-orange-500 flex items-center justify-center text-xs font-bold text-white shadow-md group-hover:scale-110 transition-transform">B</div>
                  <div className="flex flex-col leading-tight">
                     <span className="font-semibold text-main">BTC</span>
                     <span className="text-[10px] text-muted">Bitcoin</span>
                  </div>
               </div>
               <div className="flex flex-col items-end leading-tight">
                  <span className="font-semibold text-main">0.452</span>
                  <span className="text-[10px] text-muted">$29,032.18</span>
               </div>
            </div>
            <div className="flex justify-between items-center bg-panel/50 p-2 rounded-lg border border-main/50 hover:border-white/20 transition-colors cursor-pointer group">
               <div className="flex gap-2 items-center">
                  <div className="w-7 h-7 rounded-full border-2 border-main flex items-center justify-center text-xs font-bold text-muted shadow-sm group-hover:scale-110 transition-transform">$$</div>
                  <div className="flex flex-col leading-tight">
                     <span className="font-semibold text-main">USD</span>
                     <span className="text-[10px] text-muted">US Dollar</span>
                  </div>
               </div>
               <div className="flex flex-col items-end leading-tight">
                  <span className="font-semibold text-main">13,467.82</span>
                  <span className="text-[10px] text-muted">Available</span>
               </div>
            </div>
         </div>
      </div>
   );
}
