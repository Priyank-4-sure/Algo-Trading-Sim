import { useState } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { Search, Filter, Star, TrendingUp, TrendingDown } from 'lucide-react';
import { MiniSparkline } from '../shared/MiniSparkline';
import { DashboardContextType } from '../layouts/Layout';

export function MarketsPage() {
  // 1. Pull everything from our global context!
  const { markets, setActiveSymbol, watchlist, toggleWatchlist } = useOutletContext<DashboardContextType>();
  const navigate = useNavigate();

  const [filter, setFilter] = useState<'all' | 'gainers' | 'losers'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Use the global markets array instead of a hardcoded one
  const filteredData = markets.filter(a => {
    if (searchQuery && !a.symbol.toLowerCase().includes(searchQuery.toLowerCase()) && !a.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    // Note: MockData has `change` as a string (e.g., "+2.45%"). We parse it to a float for the filter.
    const changeVal = parseFloat(a.change.replace('%', ''));
    if (filter === 'gainers') return changeVal > 0;
    if (filter === 'losers') return changeVal < 0;
    return true;
  });

  // Action Handler for Chart/Trade Buttons
  const handleTradeClick = (symbol: string) => {
    setActiveSymbol(symbol); // Update the global active coin
    navigate('/app/trade');  // Send them to the trade page!
  };

  // Setup top cards (using parsed change values)
  const sortedByGain = [...markets].sort((a, b) => parseFloat(b.change) - parseFloat(a.change));
  const topCharts = [
    { title: 'Top Gainer', ...sortedByGain[0] },
    { title: 'Top Loser', ...sortedByGain[sortedByGain.length - 1] },
    { title: 'Trending', ...markets.find(m => m.symbol === 'SOL/INR')! },
    { title: 'Most Active', ...markets.find(m => m.symbol === 'BTC/INR')! }
  ].filter(Boolean); // filter out any undefined if data is missing

  return (
    <div className="flex flex-col w-full h-full gap-0 overflow-hidden select-none font-sans">
      {/* Upper Panel: Four Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-0 shrink-0 pb-1">
        {topCharts.map((asset, idx) => {
          const changeNum = parseFloat(asset.change);
          return (
            <div key={idx} className={`${idx === 0 ? '' : 'pl-1'}`}>
              <div className="glass-panel rounded-lg p-3 h-full cursor-pointer hover:bg-panel/50 transition-colors" onClick={() => handleTradeClick(asset.symbol)}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${asset.iconColor || 'bg-main'}`}>
                      {asset.icon || asset.symbol.slice(0, 1)}
                    </div>
                    <div>
                      <div className="font-bold text-main text-sm">{asset.symbol}</div>
                      <div className="text-[10px] text-muted">{asset.title}</div>
                    </div>
                  </div>
                  <div className={`flex items-center gap-1 text-sm font-bold ${asset.isPositive ? 'text-up' : 'text-down'}`}>
                    {asset.isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {asset.change}
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <span className="text-lg font-bold font-mono text-main">{asset.price}</span>
                  {/* Note: In a real app, sparkline data would be in your mockData */}
                  <MiniSparkline data={[1, 3, 2, 4, 3, 5, 4, 6]} width={80} height={28} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Lower Panel: Table */}
      <div className="flex-1 pt-1">
        <div className="glass-panel rounded-lg flex flex-col overflow-hidden h-full">
          {/* ... Table Header Controls stay exactly the same ... */}
          <div className="px-3 py-2 border-b border-main flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <span className="font-semibold text-sm">Markets Overview</span>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {/* Search & Filters */}
              <div className="flex items-center bg-main/50 rounded px-2 py-1 border border-main gap-1.5 flex-1 sm:flex-none focus-within:border-white/50 transition-colors">
                <Search size={12} className="text-muted" />
                <input type="text" placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="bg-transparent text-main text-xs outline-none w-full sm:w-16 placeholder:text-muted" />
              </div>
              <div className="flex gap-1">
                {(['all', 'gainers', 'losers'] as const).map(f => (
                  <button key={f} onClick={() => setFilter(f)} className={`text-xs uppercase font-bold px-2 py-1 rounded transition-all ${filter === f ? 'bg-panel border border-white/20 text-main' : 'text-muted hover:text-main hover:bg-panel'}`}>
                    {f === 'all' ? <Filter size={10} /> : f}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-auto no-scrollbar">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-panel z-10">
                <tr className="text-muted border-b border-subtle text-[10px] uppercase tracking-wider">
                  <th className="pb-2 pt-2 px-3 font-medium">#</th>
                  <th className="pb-2 pt-2 px-2 font-medium">Asset</th>
                  <th className="pb-2 pt-2 px-2 font-medium text-right">Price</th>
                  <th className="pb-2 pt-2 px-2 font-medium text-right">24h</th>
                  <th className="pb-2 pt-2 px-2 font-medium text-right hidden sm:table-cell">High</th>
                  <th className="pb-2 pt-2 px-2 font-medium text-right hidden md:table-cell">Low</th>
                  <th className="pb-2 pt-2 px-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-subtle">
                {filteredData.map((asset, i) => {
                  const isWatched = watchlist.includes(asset.symbol);

                  return (
                    <tr key={asset.symbol} className="group hover:bg-main/30 transition-colors">
                      <td className="py-2 px-3 text-muted text-sm">{i + 1}</td>
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-2">
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white ${asset.iconColor || 'bg-main'}`}>
                            {asset.icon || asset.symbol.slice(0, 1)}
                          </div>
                          <div>
                            <span className="font-semibold text-main text-sm">{asset.symbol}</span>
                            <span className="text-muted text-[10px] ml-1 hidden sm:inline">{asset.name}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-2 px-2 font-mono text-right text-main font-semibold text-sm">{asset.price}</td>
                      <td className={`py-2 px-2 font-mono text-right font-bold text-sm ${asset.isPositive ? 'text-up' : 'text-down'}`}>
                        {asset.change}
                      </td>
                      <td className="py-2 px-2 font-mono text-right text-muted hidden sm:table-cell text-sm">{asset.high}</td>
                      <td className="py-2 px-2 font-mono text-right text-muted hidden md:table-cell text-sm">{asset.low}</td>
                      <td className="py-2 px-3 text-right w-32">
                        {/* --- ACTIONS --- */}
                        <div className="flex justify-end items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          <button onClick={() => handleTradeClick(asset.symbol)} className="text-[10px] bg-panel border border-main px-2 py-0.5 rounded hover:border-white/50 transition-colors text-main font-bold">Chart</button>
                          <button onClick={() => handleTradeClick(asset.symbol)} className="text-[10px] bg-up px-2 py-0.5 rounded hover:brightness-110 transition-colors text-white font-bold">Trade</button>
                          
                          {/* Watchlist Toggle */}
                          <button 
                            onClick={() => toggleWatchlist(asset.symbol)} 
                            className={`p-0.5 transition-colors ${isWatched ? 'text-yellow-400' : 'text-muted hover:text-yellow-400'}`} 
                            title={isWatched ? "Remove from Watchlist" : "Add to Watchlist"}
                          >
                            <Star size={14} fill={isWatched ? "currentColor" : "none"} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}