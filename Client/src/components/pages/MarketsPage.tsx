import { useState } from 'react';
import { Search, Filter, Star, TrendingUp, TrendingDown } from 'lucide-react';
import { MiniSparkline } from '../shared/MiniSparkline';

interface MarketAsset {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  volume: string;
  marketCap: string;
  sparkline: number[];
  color: string;
}

const MARKET_DATA: MarketAsset[] = [
  { symbol: 'BTC', name: 'Bitcoin', price: 64230.50, change24h: 2.45, volume: '$42.1B', marketCap: '$1.26T', sparkline: [58000, 59200, 60100, 59800, 61500, 62800, 63100, 64230], color: '#F7931A' },
  { symbol: 'ETH', name: 'Ethereum', price: 3380.20, change24h: -1.12, volume: '$18.3B', marketCap: '$406B', sparkline: [3200, 3350, 3280, 3420, 3380, 3310, 3390, 3380], color: '#627EEA' },
  { symbol: 'SOL', name: 'Solana', price: 148.45, change24h: 5.30, volume: '$4.2B', marketCap: '$65.8B', sparkline: [125, 130, 128, 135, 140, 138, 145, 148], color: '#9945FF' },
  { symbol: 'BNB', name: 'Binance Coin', price: 598.30, change24h: 1.85, volume: '$2.1B', marketCap: '$89.7B', sparkline: [570, 575, 580, 585, 590, 588, 595, 598], color: '#F3BA2F' },
  { symbol: 'XRP', name: 'Ripple', price: 0.5234, change24h: -0.45, volume: '$1.8B', marketCap: '$28.4B', sparkline: [0.51, 0.52, 0.53, 0.52, 0.525, 0.52, 0.523, 0.523], color: '#23292F' },
  { symbol: 'ADA', name: 'Cardano', price: 0.4521, change24h: 3.21, volume: '$890M', marketCap: '$16.1B', sparkline: [0.42, 0.43, 0.44, 0.435, 0.44, 0.445, 0.45, 0.452], color: '#0033AD' },
  { symbol: 'AVAX', name: 'Avalanche', price: 35.60, change24h: 3.10, volume: '$780M', marketCap: '$13.2B', sparkline: [29, 30, 31, 30.5, 32, 33, 34, 35.6], color: '#E84142' },
  { symbol: 'DOT', name: 'Polkadot', price: 6.82, change24h: -2.15, volume: '$450M', marketCap: '$9.1B', sparkline: [7.2, 7.1, 7.0, 6.95, 6.9, 6.85, 6.8, 6.82], color: '#E6007A' },
  { symbol: 'LINK', name: 'Chainlink', price: 14.85, change24h: -0.80, volume: '$620M', marketCap: '$8.7B', sparkline: [13, 13.5, 14, 13.8, 14.2, 14.5, 14.9, 14.85], color: '#2A5ADA' },
  { symbol: 'MATIC', name: 'Polygon', price: 0.712, change24h: 1.56, volume: '$380M', marketCap: '$6.6B', sparkline: [0.68, 0.69, 0.70, 0.695, 0.70, 0.705, 0.71, 0.712], color: '#8247E5' },
];

export function MarketsPage() {
  const [filter, setFilter] = useState<'all' | 'gainers' | 'losers'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredData = MARKET_DATA.filter(a => {
    if (searchQuery && !a.symbol.toLowerCase().includes(searchQuery.toLowerCase()) && !a.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (filter === 'gainers') return a.change24h > 0;
    if (filter === 'losers') return a.change24h < 0;
    return true;
  });

  // Top 4 for charts
  const sortedByGain = [...MARKET_DATA].sort((a, b) => b.change24h - a.change24h);
  const topCharts = [
    { title: 'Top Gainer', ...sortedByGain[0] },
    { title: 'Top Loser', ...sortedByGain[sortedByGain.length - 1] },
    { title: 'Trending', ...MARKET_DATA.find(m => m.symbol === 'SOL')! },
    { title: 'Most Active', ...MARKET_DATA.find(m => m.symbol === 'BTC')! }
  ];

  return (
    <div className="flex flex-col w-full h-full gap-0 overflow-hidden select-none font-sans">
      {/* Upper Panel: Four Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-0 shrink-0 pb-1">
        {topCharts.map((asset, idx) => (
          <div key={idx} className={`${idx === 0 ? '' : 'pl-1'}`}>
            <div className="glass-panel rounded-lg p-3 h-full">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ backgroundColor: asset.color }}>
                    {asset.symbol.slice(0, 2)}
                  </div>
                  <div>
                    <div className="font-bold text-main text-sm">{asset.symbol}/USD</div>
                    <div className="text-[10px] text-muted">{asset.title}</div>
                  </div>
                </div>
                <div className={`flex items-center gap-1 text-sm font-bold ${asset.change24h >= 0 ? 'text-up' : 'text-down'}`}>
                  {asset.change24h >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  {asset.change24h >= 0 ? '+' : ''}{asset.change24h.toFixed(2)}%
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold font-mono text-main">${asset.price.toLocaleString()}</span>
                <MiniSparkline data={asset.sparkline} width={80} height={28} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Lower Panel: Table */}
      <div className="flex-1 pt-1">
        <div className="glass-panel rounded-lg flex flex-col overflow-hidden h-full">
          <div className="px-3 py-2 border-b border-main flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <span className="font-semibold text-sm">Markets Overview</span>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="flex items-center bg-main/50 rounded px-2 py-1 border border-main gap-1.5 flex-1 sm:flex-none focus-within:border-white/50 transition-colors">
                <Search size={12} className="text-muted" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="bg-transparent text-main text-xs outline-none w-full sm:w-16 placeholder:text-muted"
                />
              </div>
              <div className="flex gap-1">
                {(['all', 'gainers', 'losers'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`text-xs uppercase font-bold px-2 py-1 rounded transition-all ${
                      filter === f ? 'bg-panel border border-white/20 text-main' : 'text-muted hover:text-main hover:bg-panel'
                    }`}
                  >
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
                  <th className="pb-2 pt-2 px-2 font-medium text-right hidden sm:table-cell">Volume</th>
                  <th className="pb-2 pt-2 px-2 font-medium text-right hidden md:table-cell">MCap</th>
                  <th className="pb-2 pt-2 px-2 font-medium text-right hidden lg:table-cell">7D</th>
                  <th className="pb-2 pt-2 px-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-subtle">
                {filteredData.map((asset, i) => (
                  <tr key={asset.symbol} className="group hover:bg-main/30 transition-colors">
                    <td className="py-2 px-3 text-muted text-sm">{i + 1}</td>
                    <td className="py-2 px-2">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white" style={{ backgroundColor: asset.color }}>
                          {asset.symbol.slice(0, 2)}
                        </div>
                        <div>
                          <span className="font-semibold text-main text-sm">{asset.symbol}</span>
                          <span className="text-muted text-[10px] ml-1 hidden sm:inline">{asset.name}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-2 px-2 font-mono text-right text-main font-semibold text-sm">
                      ${asset.price.toLocaleString(undefined, { maximumFractionDigits: asset.price < 1 ? 4 : 2 })}
                    </td>
                    <td className={`py-2 px-2 font-mono text-right font-bold text-sm ${asset.change24h >= 0 ? 'text-up' : 'text-down'}`}>
                      {asset.change24h >= 0 ? '+' : ''}{asset.change24h.toFixed(2)}%
                    </td>
                    <td className="py-2 px-2 font-mono text-right text-muted hidden sm:table-cell text-sm">{asset.volume}</td>
                    <td className="py-2 px-2 font-mono text-right text-muted hidden md:table-cell text-sm">{asset.marketCap}</td>
                    <td className="py-2 px-2 text-right hidden lg:table-cell">
                      <MiniSparkline data={asset.sparkline} />
                    </td>
                    <td className="py-2 px-3 text-right w-32">
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <button className="text-[10px] bg-panel border border-main px-2 py-0.5 rounded hover:border-white/50 transition-colors text-main font-bold">Chart</button>
                        <button className="text-[10px] bg-up px-2 py-0.5 rounded hover:brightness-110 transition-colors text-white font-bold">Trade</button>
                        <button className="text-muted hover:text-yellow-400 transition-colors p-0.5" title="Add to Watchlist">
                          <Star size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
