import { useState } from 'react';
import { TrendingUp, DollarSign, BarChart2, Award, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface StatCard {
  label: string;
  value: string;
  change?: string;
  isPositive?: boolean;
  icon: React.ReactNode;
}

export function AnalyticsPage() {
  const [timeframe, setTimeframe] = useState('1M');

  const portfolioHistory = {
    '1W': [45000, 44800, 46200, 45500, 47000, 46800, 48200],
    '1M': [38000, 39200, 38500, 40100, 41500, 39800, 42000, 43500, 41200, 43800, 44200, 42500, 45000, 44800, 46200, 45500, 47000, 46800, 48200, 47500],
    '3M': Array.from({length: 40}, () => 35000 + Math.random() * 15000),
    'ALL': Array.from({length: 60}, () => 20000 + Math.random() * 30000)
  }[timeframe] || [];

  const allocation = [
    { symbol: 'BTC', percentage: 45, color: '#F7931A' },
    { symbol: 'ETH', percentage: 25, color: '#627EEA' },
    { symbol: 'SOL', percentage: 15, color: '#9945FF' },
    { symbol: 'Others', percentage: 15, color: '#888888' },
  ];

  const dailyPnL = Array.from({ length: 14 }).map(() => (Math.random() - 0.4) * 1000);

  const [recentTrades] = useState([
    { symbol: 'BTC/USD', side: 'Buy', price: 62450, pnl: +801.22, date: '2024-03-24' },
    { symbol: 'ETH/USD', side: 'Sell', price: 3450, pnl: +147.97, date: '2024-03-23' },
    { symbol: 'SOL/USD', side: 'Buy', price: 152, pnl: -159.75, date: '2024-03-22' },
    { symbol: 'BTC/USD', side: 'Sell', price: 63100, pnl: +520.40, date: '2024-03-21' },
    { symbol: 'AVAX/USD', side: 'Buy', price: 28, pnl: +608.00, date: '2024-03-20' },
  ]);

  const stats: StatCard[] = [
    { label: 'Total Trades', value: '247', change: '+12 this week', isPositive: true, icon: <BarChart2 size={18} /> },
    { label: 'Win Rate', value: '68.2%', change: '+2.1%', isPositive: true, icon: <Award size={18} /> },
    { label: 'Avg Profit', value: '$342.50', change: '+$45.20', isPositive: true, icon: <DollarSign size={18} /> },
    { label: 'Best Trade', value: '+$2,450', change: 'BTC/USD', icon: <TrendingUp size={18} /> },
  ];

  return (
    <div className="flex flex-col w-full h-full gap-0 overflow-hidden select-none p-0 font-sans focus:outline-none focus:ring-0">
      {/* Stat Cards Row with spacing */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 shrink-0 p-4 pb-0">
        {stats.map((stat, i) => (
          <div key={i} className="glass-panel rounded-xl p-3 flex flex-col border border-main shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-muted uppercase tracking-wider font-medium">{stat.label}</span>
              <div className="text-muted">{stat.icon}</div>
            </div>
            <div className="text-xl font-bold text-main font-mono">{stat.value}</div>
            {stat.change && (
              <div className={`text-[10px] mt-1 ${stat.isPositive ? 'text-up' : 'text-down'}`}>
                {stat.change}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Main Content: Flush panels like TradePage */}
      <div className="flex flex-col lg:flex-row gap-0 flex-1 min-h-0 overflow-y-auto lg:overflow-hidden no-scrollbar border-t border-main">
        
        {/* Left Column: Charts Column */}
        <div className="flex-1 flex flex-col gap-0 min-h-0 border-r border-main">
          
          {/* Portfolio Performance Chart Panel */}
          <div className="flex-[2] glass-panel rounded-none flex flex-col overflow-hidden shadow-none border-none border-b border-main">
            <div className="px-5 py-3 border-b border-main font-semibold text-sm flex items-center justify-between font-display bg-panel">
              <span>Portfolio Performance</span>
              <div className="flex gap-2">
                {['1W', '1M', '3M', 'ALL'].map(period => (
                  <button 
                    key={period} 
                    onClick={() => setTimeframe(period)}
                    className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${period === timeframe ? 'bg-panel border border-white/20 text-main shadow-sm' : 'text-muted hover:text-main'}`}>
                    {period}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 p-5 flex items-center justify-center">
              <div className="w-full h-full flex items-end gap-1.5">
                {portfolioHistory.map((value, i) => {
                  const max = Math.max(...portfolioHistory);
                  const min = Math.min(...portfolioHistory);
                  const height = ((value - min) / (max - min)) * 100;
                  const isLast = i === portfolioHistory.length - 1;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group">
                      <div className="text-[10px] text-main font-bold opacity-0 group-hover:opacity-100 transition-opacity mb-2 font-mono pb-1 border-b border-white/20">
                        ${(value / 1000).toFixed(1)}k
                      </div>
                      <div
                        className={`w-full rounded-t-sm transition-all ${
                          isLast 
                            ? 'bg-up shadow-[0_0_15px_rgba(34,197,94,0.6)]' 
                            : 'bg-gradient-to-t from-green-600/10 to-green-500/30 border border-b-0 border-green-500/30 hover:to-green-400/50 hover:border-green-400/50'
                        }`}
                        style={{ height: `${Math.max(height, 5)}%` }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Asset Allocation & Daily P&L Panel Row */}
          <div className="flex-1 flex flex-col sm:flex-row gap-0 min-h-[220px]">
            {/* Daily P&L Panel */}
            <div className="flex-1 glass-panel rounded-none flex flex-col overflow-hidden shadow-none p-5 border-none border-r border-main border-t lg:border-t-0">
              <div className="font-semibold text-sm font-display mb-4">Daily P&L (14D)</div>
              <div className="flex-1 w-full h-full min-h-[140px] flex items-center justify-between gap-1.5 py-4 relative">
                {/* Center baseline indicator */}
                <div className="absolute top-1/2 left-0 right-0 h-px bg-white/10 -translate-y-px pointer-events-none" />
                
                {dailyPnL.map((pnl, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center justify-center h-full group relative">
                    {/* Tooltip on hover */}
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black/90 px-2 py-1 rounded text-[10px] font-mono whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-20 shadow-xl border border-white/20">
                      {pnl >= 0 ? '+' : ''}${pnl.toFixed(0)}
                    </div>
                    
                    {/* Top Half (Positive Zone) */}
                    <div className="w-full h-1/2 flex flex-col justify-end items-center">
                      {pnl >= 0 && (
                        <div className="w-[80%] bg-up rounded-t-sm hover:brightness-125 transition-all shadow-[0_0_10px_rgba(34,197,94,0.3)]" style={{ height: `${Math.max((pnl / 1000) * 100, 8)}%` }} />
                      )}
                    </div>
                    
                    {/* Bottom Half (Negative Zone) */}
                    <div className="w-full h-1/2 flex flex-col justify-start items-center">
                      {pnl < 0 && (
                        <div className="w-[80%] bg-down rounded-b-sm hover:brightness-125 transition-all shadow-[0_0_10px_rgba(239,68,68,0.3)]" style={{ height: `${Math.max(Math.abs(pnl) / 1000 * 100, 8)}%` }} />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Asset Allocation Panel */}
            <div className="flex-1 glass-panel rounded-none flex flex-col overflow-hidden shadow-none p-5 border-none border-t sm:border-t-0 border-main">
              <div className="font-semibold text-sm font-display mb-4">Asset Allocation</div>
              <div className="flex flex-col gap-3 flex-1 justify-center">
                {allocation.map(a => (
                  <div key={a.symbol} className="flex flex-col gap-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-bold text-main">{a.symbol}</span>
                      <span className="font-mono text-muted">{a.percentage}%</span>
                    </div>
                    <div className="h-2 w-full bg-panel rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${a.percentage}%`, backgroundColor: a.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
        </div>

        {/* Right Column: Recent Trades Panel */}
        <div className="w-full lg:w-[350px] glass-panel rounded-none flex flex-col overflow-hidden shadow-none border-none">
          <div className="px-5 py-4 border-b border-main font-semibold text-sm font-display bg-panel">Recent Trades</div>
          <div className="flex-1 overflow-auto no-scrollbar p-2">
            {recentTrades.map((trade, i) => (
              <div key={i} className="px-3 py-4 flex items-center justify-between border-b border-main/30 hover:bg-panel/50 transition-colors rounded-lg group">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-transform group-hover:scale-110 ${trade.side === 'Buy' ? 'bg-up/20' : 'bg-down/20'}`}>
                    {trade.side === 'Buy' ? <ArrowUpRight size={14} className="text-up" /> : <ArrowDownRight size={14} className="text-down" />}
                  </div>
                  <div>
                    <div className="font-bold text-main text-sm">{trade.symbol}</div>
                    <div className="text-[10px] text-muted font-medium">{trade.date}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`font-mono font-bold text-base ${trade.pnl >= 0 ? 'text-up' : 'text-down'}`}>
                    {trade.pnl >= 0 ? '+' : ''}${Math.abs(trade.pnl).toFixed(2)}
                  </div>
                  <div className="text-xs text-muted font-mono mt-0.5">${trade.price.toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
