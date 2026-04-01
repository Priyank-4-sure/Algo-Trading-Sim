import { useOutletContext, useNavigate } from 'react-router-dom';
import { Star, TrendingUp, TrendingDown, BookOpen } from 'lucide-react';
import { DashboardContextType } from '../layouts/Layout';

export function WatchlistPage() {
  const { markets, setActiveSymbol, watchlist, toggleWatchlist } = useOutletContext<DashboardContextType>();
  const navigate = useNavigate();

  // Filter our global markets array to ONLY include watched symbols
  const watchedAssets = markets.filter(market => watchlist.includes(market.symbol));

  const handleTradeClick = (symbol: string) => {
    setActiveSymbol(symbol);
    navigate('/app/trade');
  };

  return (
    <div className="flex flex-col w-full h-full gap-2 overflow-hidden select-none font-sans pt-1">
      <div className="glass-panel rounded-lg flex flex-col overflow-hidden h-full">
        <div className="px-4 py-3 border-b border-main flex items-center gap-2">
          <Star size={16} className="text-yellow-400" fill="currentColor" />
          <span className="font-semibold text-base">My Watchlist</span>
          <span className="text-xs text-muted font-normal ml-2">{watchedAssets.length} Assets</span>
        </div>

        <div className="flex-1 overflow-auto no-scrollbar">
          {watchedAssets.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted opacity-60">
              <BookOpen size={48} className="mb-4" />
              <p className="text-sm font-bold">Your watchlist is empty</p>
              <p className="text-xs mt-1">Go to the Markets page to add some assets.</p>
              <button onClick={() => navigate('/app/markets')} className="mt-4 text-xs bg-panel border border-main px-4 py-2 rounded-md hover:border-white/50 text-main font-bold transition-colors">
                Explore Markets
              </button>
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-panel z-10">
                <tr className="text-muted border-b border-subtle text-[10px] uppercase tracking-wider">
                  <th className="pb-2 pt-2 px-4 font-medium">Asset</th>
                  <th className="pb-2 pt-2 px-2 font-medium text-right">Price</th>
                  <th className="pb-2 pt-2 px-2 font-medium text-right">24h Change</th>
                  <th className="pb-2 pt-2 px-2 font-medium text-right hidden sm:table-cell">24h High</th>
                  <th className="pb-2 pt-2 px-2 font-medium text-right hidden sm:table-cell">24h Low</th>
                  <th className="pb-2 pt-2 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-subtle">
                {watchedAssets.map((asset) => (
                  <tr key={asset.symbol} className="group hover:bg-main/30 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${asset.iconColor || 'bg-main'}`}>
                          {asset.icon || asset.symbol.slice(0, 1)}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-main text-sm leading-tight">{asset.symbol}</span>
                          <span className="text-muted text-[10px]">{asset.name}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-2 font-mono text-right text-main font-bold text-sm">{asset.price}</td>
                    <td className="py-3 px-2 text-right">
                      <div className={`inline-flex items-center gap-1 font-mono font-bold text-sm ${asset.isPositive ? 'text-up' : 'text-down'}`}>
                        {asset.isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        {asset.change}
                      </div>
                    </td>
                    <td className="py-3 px-2 font-mono text-right text-muted hidden sm:table-cell text-sm">{asset.high}</td>
                    <td className="py-3 px-2 font-mono text-right text-muted hidden sm:table-cell text-sm">{asset.low}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex justify-end items-center gap-2">
                        <button onClick={() => handleTradeClick(asset.symbol)} className="text-[10px] bg-panel border border-main px-3 py-1 rounded hover:border-white/50 transition-colors text-main font-bold">Trade</button>
                        <button 
                          onClick={() => toggleWatchlist(asset.symbol)} 
                          className="p-1 text-yellow-400 hover:text-muted transition-colors opacity-0 group-hover:opacity-100" 
                          title="Remove from Watchlist"
                        >
                          <Star size={14} fill="currentColor" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}