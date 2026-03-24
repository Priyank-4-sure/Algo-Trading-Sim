import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Activity, Target, AlertTriangle, ChevronDown } from 'lucide-react';
import { usePortfolio } from '../../hooks/usePortfolio';
import { AnimatedValue } from '../shared/AnimatedValue';
import { MiniSparkline } from '../shared/MiniSparkline';

export function PortfolioPage() {
  const {
    holdings, cashBalance, totalPortfolioValue,
    totalUnrealizedPnL, totalPnLPercentage,
    riskMetrics, concentrationWarning, updatePrice,
  } = usePortfolio();

  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'value' | 'pnl' | 'change'>('value');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    const interval = setInterval(() => {
      holdings.forEach((h) => {
        const changePercent = (Math.random() - 0.5) * 0.004;
        const newPrice = h.currentPrice * (1 + changePercent);
        const change24h = h.change24hPercent + (Math.random() - 0.5) * 0.1;
        updatePrice(h.id, newPrice, change24h);
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [holdings, updatePrice]);

  const sortedHoldings = [...holdings].sort((a, b) => {
    let aVal = 0, bVal = 0;
    if (sortBy === 'value') { aVal = a.value; bVal = b.value; }
    else if (sortBy === 'pnl') { aVal = a.unrealizedPnL; bVal = b.unrealizedPnL; }
    else { aVal = a.change24hPercent; bVal = b.change24hPercent; }
    return sortDir === 'desc' ? bVal - aVal : aVal - bVal;
  });

  const isPositivePnL = totalUnrealizedPnL >= 0;

  return (
    <div className="flex flex-col md:flex-row w-full h-full gap-0 overflow-hidden select-none p-0 font-sans focus:outline-none focus:ring-0">
      {/* Left Column: Stats Cards & Side Panels */}
      <div className="w-full md:w-[320px] flex flex-col gap-0 shrink-0 border-r border-main bg-panel">
        {/* Total Value Card (with spacing) */}
        <div className="p-4 bg-main">
          <div className="glass-panel rounded-xl p-3 border border-main shadow-lg">
          <div className="text-[10px] text-muted uppercase tracking-wider font-medium mb-1">Total Portfolio Value</div>
          <div className="text-2xl font-bold text-main mb-2">
            <AnimatedValue value={totalPortfolioValue} prefix="$" decimals={2} size="lg" />
          </div>
          <div className="text-xs text-muted">
            24h: <span className={isPositivePnL ? 'text-up' : 'text-down'}>
              {isPositivePnL ? '+' : ''}{totalPnLPercentage.toFixed(2)}%
            </span>
          </div>
        </div>

        <div className={`glass-panel rounded-lg p-3 border-l-2 ${isPositivePnL ? 'border-l-[var(--trading-green)]' : 'border-l-[var(--trading-red)]'}`}>
          <div className="text-[10px] text-muted uppercase tracking-wider font-medium mb-1">Unrealized P&L</div>
          <div className={`text-xl font-bold font-mono ${isPositivePnL ? 'text-up' : 'text-down'}`}>
            <AnimatedValue value={Math.abs(totalUnrealizedPnL)} prefix={isPositivePnL ? '+$' : '-$'} decimals={2} size="md" />
          </div>
        </div>

        <div className="glass-panel rounded-lg p-3">
          <div className="text-[10px] text-muted uppercase tracking-wider font-medium mb-1">Available Cash</div>
          <div className="text-lg font-mono font-semibold text-main">
            <AnimatedValue value={cashBalance} prefix="$" decimals={2} />
          </div>
        </div>

        </div>
        
        {/* Side Panels: Seamlessly integrated */}
        <div className="glass-panel rounded-none flex-1 overflow-hidden flex flex-col min-h-[200px] shadow-none border-none border-t border-main">
          <div className="px-5 py-3 border-b border-main bg-panel/50">
            <span className="font-semibold text-sm font-display">Risk Metrics</span>
          </div>
          <div className="p-3 space-y-3 overflow-y-auto no-scrollbar">
            {[
              { icon: <TrendingUp size={12} className="text-up" />, label: 'Sharpe Ratio', value: riskMetrics.sharpeRatio.toFixed(2) },
              { icon: <TrendingDown size={12} className="text-down" />, label: 'Max Drawdown', value: `${riskMetrics.maxDrawdown.toFixed(1)}%` },
              { icon: <Activity size={12} className="text-muted" />, label: 'Volatility', value: `${riskMetrics.volatility.toFixed(1)}%` },
              { icon: <Target size={12} className="text-up" />, label: 'Win Rate', value: `${riskMetrics.winRate.toFixed(1)}%` },
            ].map((metric, i) => (
              <div key={i} className="flex justify-between items-center p-2.5 bg-panel/50 rounded-lg border border-main/30 group hover:border-white/20 transition-colors">
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5 mb-1">
                    {metric.icon}
                    <span className="text-[10px] uppercase font-bold text-muted tracking-wider">{metric.label}</span>
                  </div>
                </div>
                <span className="text-base font-bold text-main font-mono">{metric.value}</span>
              </div>
            ))}

            {concentrationWarning && concentrationWarning.percentage > 40 && (
              <div className="p-2 bg-yellow-500/10 border border-yellow-500/20 rounded flex items-start gap-2">
                <AlertTriangle size={12} className="text-yellow-500 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <div className="text-xs font-medium text-yellow-500">High Concentration</div>
                  <div className="text-[10px] text-muted mt-0.5">
                    {concentrationWarning.asset} is {concentrationWarning.percentage.toFixed(0)}% of portfolio
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        {/* Recent Activity Panel */}
        <div className="glass-panel rounded-none flex-1 overflow-hidden flex flex-col min-h-[160px] shadow-none border-none border-t border-main">
          <div className="px-5 py-3 border-b border-main bg-panel/50">
            <span className="font-semibold text-sm font-display">Recent Activity</span>
          </div>
          <div className="p-3 space-y-2 overflow-y-auto no-scrollbar">
            {[
              { text: 'Bought 0.452 BTC', time: '2h ago', color: 'text-up' },
              { text: 'Sold 15.0 SOL', time: '5h ago', color: 'text-down' },
              { text: 'Deposit $5,000', time: '1d ago', color: 'text-main' },
              { text: 'Staked 1,200 ADA', time: '2d ago', color: 'text-muted' },
            ].map((act, i) => (
              <div key={i} className="flex justify-between items-center p-2 text-sm border-b border-white/5 last:border-0 hover:bg-main/30 rounded transition-colors">
                <span className={`font-semibold ${act.color}`}>{act.text}</span>
                <span className="text-xs text-muted font-mono">{act.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Content: Seamless Holdings Table Panel */}
      <div className="flex-1 glass-panel rounded-none flex flex-col overflow-hidden shadow-none border-none">
        <div className="px-5 py-4 border-b border-main font-semibold text-lg font-display flex items-center justify-between bg-panel">
          <span>Holdings ({holdings.length} assets)</span>
          <div className="flex gap-2 font-medium bg-main p-1 rounded-lg border border-main">
            {(['value', 'pnl'] as const).map(key => (
              <button
                key={key}
                onClick={() => {
                  if (sortBy === key) setSortDir((d: 'asc' | 'desc') => d === 'asc' ? 'desc' : 'asc');
                  else { setSortBy(key); setSortDir('desc'); }
                }}
                className={`text-xs uppercase font-bold px-4 py-1.5 rounded-md transition-all ${
                  sortBy === key ? 'bg-panel shadow text-main border-white/20' : 'text-muted hover:text-main'
                }`}
              >
                {key === 'value' ? 'Value' : 'P&L'} {sortBy === key && (sortDir === 'desc' ? '↓' : '↑')}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-auto no-scrollbar">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-panel z-10">
              <tr className="text-muted border-b border-main/50 text-xs uppercase tracking-wider bg-panel/80 backdrop-blur-sm">
                <th className="pb-3 pt-4 px-5 font-medium">Asset</th>
                <th className="pb-3 pt-4 px-4 font-medium text-right">Quantity</th>
                <th className="pb-3 pt-4 px-4 font-medium text-right hidden md:table-cell">Avg Price</th>
                <th className="pb-3 pt-4 px-4 font-medium text-right hidden lg:table-cell">Current</th>
                <th className="pb-3 pt-4 px-4 font-medium text-right hidden sm:table-cell">7D Trend</th>
                <th className="pb-3 pt-4 px-4 font-medium text-right">Value</th>
                <th className="pb-3 pt-4 px-4 font-medium text-right">P&L</th>
                <th className="pb-3 pt-4 px-4 font-medium text-right hidden xl:table-cell">Weight</th>
                <th className="pb-3 pt-4 px-5 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-main/50">
              {sortedHoldings.map((holding) => {
                const isExpanded = expandedRow === holding.id;
                const isPositive = holding.unrealizedPnL >= 0;
                const is24hPositive = holding.change24hPercent >= 0;

                return (
                  <tr
                    key={holding.id}
                    className="group hover:bg-main/30 transition-colors cursor-pointer"
                    onClick={() => setExpandedRow(isExpanded ? null : holding.id)}
                  >
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm" style={{ backgroundColor: holding.color }}>
                          {holding.asset.slice(0, 2)}
                        </div>
                        <div>
                          <div className="font-bold text-main text-sm">{holding.asset}</div>
                          <div className="text-[10px] text-muted font-medium">{holding.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 font-mono text-right text-main font-semibold text-base">{holding.quantity.toFixed(4)}</td>
                    <td className="py-4 px-4 font-mono text-muted text-right hidden md:table-cell text-sm">
                      ${holding.avgPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-4 px-4 font-mono text-right hidden lg:table-cell">
                      <div className="text-base font-semibold text-main">
                        <AnimatedValue value={holding.currentPrice} prefix="$" decimals={2} size="sm" />
                      </div>
                      <div className={`text-xs font-bold ${is24hPositive ? 'text-up' : 'text-down'}`}>
                        {is24hPositive ? '+' : ''}{holding.change24hPercent.toFixed(2)}%
                      </div>
                    </td>
                    <td className="py-4 px-4 text-right hidden sm:table-cell">
                      <MiniSparkline data={holding.sparklineData} />
                    </td>
                    <td className="py-4 px-4 font-mono text-right font-bold text-main text-base">
                      ${holding.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </td>
                    <td className={`py-4 px-4 font-mono text-right font-bold text-sm ${isPositive ? 'text-up' : 'text-down'}`}>
                      {isPositive ? '+' : ''}${Math.abs(holding.unrealizedPnL).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      <div className="text-[10px] opacity-70">({isPositive ? '+' : ''}{holding.pnLPercentage.toFixed(2)}%)</div>
                    </td>
                    <td className="py-4 px-4 text-right hidden xl:table-cell">
                      <div className="flex items-center justify-end gap-3">
                        <div className="w-16 h-2 bg-main/30 rounded-full overflow-hidden shadow-inner">
                          <div className="h-full rounded-full" style={{ backgroundColor: holding.color, width: `${Math.min(holding.portfolioWeight, 100)}%` }} />
                        </div>
                        <span className="font-mono text-xs font-bold text-muted w-8 text-right">{holding.portfolioWeight.toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="py-4 px-5 text-right flex items-center justify-end h-full">
                      <div className={`p-1.5 rounded-full bg-main/50 transition-transform ${isExpanded ? 'rotate-180 text-white' : 'text-muted'}`}>
                        <ChevronDown size={14} />
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
  );
}
