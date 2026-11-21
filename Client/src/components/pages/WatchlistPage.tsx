import { useOutletContext, useNavigate } from 'react-router-dom';
import { useContext, useState, useEffect } from 'react';
import { Star, TrendingUp, TrendingDown, BookOpen } from 'lucide-react';
import { DashboardContextType } from '../layouts/Layout';
import { useWatchlistData } from '../../hooks/useWatchlistData';
import { getSymbolMeta } from '../../data/symbolMeta';
import { useMarketPrices, MarketPriceData } from '../../hooks/useMarketPrices';
import { generateAllMockPrices } from '../../data/mockPriceGenerator';
import { AuthContext } from '../../context/AuthContext';

export function WatchlistPage() {
  const { setActiveSymbol, toggleWatchlist, watchlist } = useOutletContext<DashboardContextType>();
  const navigate = useNavigate();
  const { data, loading, refetch } = useWatchlistData(watchlist);

  const handleTradeClick = (symbol: string) => {
    setActiveSymbol(symbol);
    navigate('/app/trade');
  };

  const handleRemove = async (symbol: string) => {
    await toggleWatchlist(symbol);
    refetch();
  };

  // In offline mode, use stored watchlist data with mock price updates
  const auth = useContext(AuthContext) || { accessToken: null };
  const isOffline = !auth?.accessToken;
  const [offlinePrices, setOfflinePrices] = useState<MarketPriceData[]>([]);

  // Use useMarketPrices to provide live price updates in offline mode
  // Hook called at top level (after isOffline is determined)
  const updateHandler = (prices: MarketPriceData[]) => {
    setOfflinePrices(prices);
  };

  // Initialize mock prices when component mounts in offline mode
  useEffect(() => {
    if (isOffline) {
      const mockSymbols = [
        "Tech", "Meme", "BANK", "AAPL", "TSLA",
      ];
      generateAllMockPrices(mockSymbols);
    }
  }, [isOffline]);

  useMarketPrices(updateHandler);

  // In offline mode, map offline prices to watchlist items
  const displayedData = isOffline
    ? data.map((item: MarketPriceData) => {
        const priceData = offlinePrices.find(p => p.symbol === item.symbol);
        if (!priceData) return item;
        const isPositive = priceData.change_24h >= 0;
        return {
          ...item,
          price: `₹${priceData.price.toFixed(2)}`,
          change_24h: priceData.change_24h,
          ...(isPositive ? { change: `+${priceData.change_24h.toFixed(2)}%` } : { change: `-${Math.abs(priceData.change_24h).toFixed(2)}%` }),
        };
      })
    : data;

  return (
    <div className="flex flex-col w-full h-full gap-2 overflow-hidden select-none font-sans pt-1">
      <div className="glass-panel rounded-lg flex flex-col overflow-hidden h-full">
        <div className="px-4 py-3 border-b border-main flex items-center gap-2">
          <Star size={16} className="text-yellow-400" fill="currentColor" />
          <span className="font-semibold text-base">My Watchlist</span>
          {isOffline && (
            <span className="text-xs text-muted font-normal">Offline mode - using stored data</span>
          )}
        </div>

        <div className="flex-1 overflow-auto no-scrollbar">
          {loading ? (
            <div className="flex items-center justify-center h-full text-muted opacity-60 text-sm">
              Loading...
            </div>
          ) : data.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted opacity-60">
              <BookOpen size={48} className="mb-4" />
              <p className="text-sm font-bold">Your watchlist is empty</p>
              <p className="text-xs mt-1">Go to the Markets page to add some assets.</p>
              <button
                onClick={() => navigate('/app/markets')}
                className="mt-4 text-xs bg-panel border border-main px-4 py-2 rounded-md hover:border-white/50 text-main font-bold transition-colors"
              >
                Explore Markets
              </button>
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-panel z-10">
                <tr className="text-muted border-b border-subtle text-[10px] uppercase tracking-wider">
                  <th className="pb-2 pt-2 px-4 font-medium">Asset</th>
                  <th className="pb-2 pt-2 px-2 font-medium text-right">Price</th>
                  <th className="pb-2 pt-2 px-2 font-medium text-right">Change</th>
                  <th className="pb-2 pt-2 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-subtle">
                {displayedData.map(item => {
                  const meta = getSymbolMeta(item.symbol);
                  // Handle both online (number) and offline (string) price/change formats
                  const priceValue = typeof item.price === 'string' ? item.price : `₹${item.price.toFixed(2)}`;
                  const changeValue = typeof item.change_24h === 'number'
                    ? (item.change_24h >= 0 ? `+${item.change_24h.toFixed(2)}%` : `${item.change_24h.toFixed(2)}%`)
                    : item.change_24h; // already formatted string
                  const isPositive = typeof item.change_24h === 'number' ? item.change_24h >= 0 : changeValue.startsWith('+');

                  return (
                    <tr key={item.symbol} className="group hover:bg-main/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${meta.iconColor}`}>
                            {meta.icon}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-bold text-main text-sm leading-tight">{item.symbol}</span>
                            <span className="text-muted text-[10px]">{meta.name}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-2 font-mono text-right text-main font-bold text-sm">
                        {priceValue}
                      </td>
                      <td className="py-3 px-2 text-right">
                        <div className={`inline-flex items-center gap-1 font-mono font-bold text-sm ${isPositive ? 'text-up' : 'text-down'}`}>
                          {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                          {changeValue}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex justify-end items-center gap-2">
                          <button
                            onClick={() => handleTradeClick(item.symbol)}
                            className="text-[10px] bg-panel border border-main px-3 py-1 rounded hover:border-white/50 transition-colors text-main font-bold"
                          >
                            Trade
                          </button>
                          <button
                            onClick={() => handleRemove(item.symbol)}
                            className="p-1 text-yellow-400 hover:text-muted transition-colors opacity-0 group-hover:opacity-100"
                            title="Remove from Watchlist"
                          >
                            <Star size={14} fill="currentColor" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
