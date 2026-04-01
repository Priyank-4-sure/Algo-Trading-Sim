import React, { useEffect, useState } from 'react';
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
    <div className="flex flex-col md:flex-row w-full h-full gap-0 overflow-hidden select-none font-sans">
      {/* Left Column: Stats Cards & Side Panels */}
      <div className="w-full md:w-[280px] flex flex-col gap-0 shrink-0 pr-1">
        {/* Stats Cards */}
        <div className="pb-1">
          <div className="glass-panel rounded-lg p-3">
            <div className="text-[10px] text-muted uppercase tracking-wider font-medium mb-1">Total Portfolio Value</div>
            <div className="text-2xl font-bold text-main mb-1">
              <AnimatedValue value={totalPortfolioValue} prefix="₹" decimals={2} size="lg" />
            </div>
            <div className="text-xs text-muted">
              24h: <span className={isPositivePnL ? 'text-up' : 'text-down'}>
                {isPositivePnL ? '+' : ''}{totalPnLPercentage.toFixed(2)}%
              </span>
            </div>
          </div>
        </div>

        <div className="pb-1">
          <div className={`glass-panel rounded-lg p-3 border-l-2 ${isPositivePnL ? 'border-l-[var(--trading-green)]' : 'border-l-[var(--trading-red)]'}`}>
            <div className="text-[10px] text-muted uppercase tracking-wider font-medium mb-1">Unrealized P&L</div>
            <div className={`text-xl font-bold font-mono ${isPositivePnL ? 'text-up' : 'text-down'}`}>
              <AnimatedValue value={Math.abs(totalUnrealizedPnL)} prefix={isPositivePnL ? '+₹' : '-₹'} decimals={2} size="md" />
            </div>
          </div>
        </div>

        <div className="pb-1">
          <div className="glass-panel rounded-lg p-3">
            <div className="text-[10px] text-muted uppercase tracking-wider font-medium mb-1">Balance</div>
            <div className="text-lg font-mono font-semibold text-main">
              <AnimatedValue value={cashBalance} prefix="₹" decimals={2} />
            </div>
          </div>
        </div>

        {/* Recent Activity Panel */}
        <div className="flex-1">
          <div className="glass-panel rounded-lg flex flex-col overflow-hidden h-full">
            <div className="px-3 py-2 border-b border-main">
              <span className="font-semibold text-sm">Recent Activity</span>
            </div>
            <div className="p-2 space-y-1 overflow-y-auto no-scrollbar flex-1">
              {[
                { text: 'Bought 0.452 BTC', time: '2h ago', color: 'text-up' },
                { text: 'Sold 15.0 SOL', time: '5h ago', color: 'text-down' },
                { text: 'Deposit ₹5,000', time: '1d ago', color: 'text-main' },
                { text: 'Staked 1,200 ADA', time: '2d ago', color: 'text-muted' },
              ].map((act, i) => (
                <div key={i} className="flex justify-between items-center p-2 text-sm hover:bg-main/30 rounded transition-colors">
                  <span className={`font-semibold ${act.color}`}>{act.text}</span>
                  <span className="text-[10px] text-muted font-mono">{act.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right Content: Holdings Table Panel */}
      <div className="flex-1 pl-1">
        <div className="glass-panel rounded-lg flex flex-col overflow-hidden h-full">
          <div className="px-3 py-2 border-b border-main font-semibold text-sm flex items-center justify-between">
            <span>Holdings ({holdings.length} assets)</span>
            <div className="flex gap-1">
              {(['value', 'pnl'] as const).map(key => (
                <button
                  key={key}
                  onClick={() => {
                    if (sortBy === key) setSortDir((d: 'asc' | 'desc') => d === 'asc' ? 'desc' : 'asc');
                    else { setSortBy(key); setSortDir('desc'); }
                  }}
                  className={`text-xs uppercase font-bold px-2 py-1 rounded transition-all ${
                    sortBy === key ? 'bg-panel border border-white/20 text-main' : 'text-muted hover:text-main hover:bg-panel'
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
                <tr className="text-muted border-b border-subtle text-[10px] uppercase tracking-wider">
                  <th className="pb-2 pt-2 px-3 font-medium">Asset</th>
                  <th className="pb-2 pt-2 px-2 font-medium text-right">Qty</th>
                  <th className="pb-2 pt-2 px-2 font-medium text-right hidden md:table-cell">Avg</th>
                  <th className="pb-2 pt-2 px-2 font-medium text-right hidden lg:table-cell">Current</th>
                  <th className="pb-2 pt-2 px-2 font-medium text-right">Value</th>
                  <th className="pb-2 pt-2 px-2 font-medium text-right">P&L</th>
                  <th className="pb-2 pt-2 px-2 font-medium text-right hidden xl:table-cell">Wt</th>
                  {/* --- CHANGED: Heading updated to Buy Prices --- */}
                  <th className="pb-2 pt-2 px-3 font-medium text-right">Buy Prices</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-subtle">
                {sortedHoldings.map((holding) => {
                  const isExpanded = expandedRow === holding.id;
                  const isPositive = holding.unrealizedPnL >= 0;
                  const is24hPositive = holding.change24hPercent >= 0;

                  return (
                    // --- CHANGED: Wrapped in React.Fragment to allow the expansion row ---
                    <React.Fragment key={holding.id}>
                      <tr
                        className="group hover:bg-main/30 transition-colors cursor-pointer"
                        onClick={() => setExpandedRow(isExpanded ? null : holding.id)}
                      >
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ backgroundColor: holding.color }}>
                              {holding.asset.slice(0, 2)}
                            </div>
                            <div>
                              <div className="font-bold text-main text-sm">{holding.asset}</div>
                              <div className="text-[10px] text-muted">{holding.name}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-2 px-2 font-mono text-right text-main font-semibold text-sm">{holding.quantity.toFixed(4)}</td>
                        <td className="py-2 px-2 font-mono text-muted text-right hidden md:table-cell text-sm">
                          ₹{holding.avgPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-2 px-2 font-mono text-right hidden lg:table-cell">
                          <div className="font-semibold text-main text-sm">
                            <AnimatedValue value={holding.currentPrice} prefix="₹" decimals={2} size="sm" />
                          </div>
                          <div className={`text-[10px] font-bold ${is24hPositive ? 'text-up' : 'text-down'}`}>
                            {is24hPositive ? '+' : ''}{holding.change24hPercent.toFixed(2)}%
                          </div>
                        </td>
                        <td className="py-2 px-2 font-mono text-right font-bold text-main text-sm">
                          ₹{holding.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </td>
                        <td className={`py-2 px-2 font-mono text-right font-bold text-sm ${isPositive ? 'text-up' : 'text-down'}`}>
                          {isPositive ? '+' : ''}₹{Math.abs(holding.unrealizedPnL).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          <div className="text-[10px] opacity-70">({isPositive ? '+' : ''}{holding.pnLPercentage.toFixed(1)}%)</div>
                        </td>
                        <td className="py-2 px-2 text-right hidden xl:table-cell">
                          <div className="flex items-center justify-end gap-1">
                            <div className="w-10 h-1 bg-main/30 rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ backgroundColor: holding.color, width: `${Math.min(holding.portfolioWeight, 100)}%` }} />
                            </div>
                            <span className="font-mono text-[10px] font-bold text-muted w-5 text-right">{holding.portfolioWeight.toFixed(0)}%</span>
                          </div>
                        </td>
                        <td className="py-2 px-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-[10px] text-muted font-bold tracking-wider group-hover:text-main transition-colors">HISTORY</span>
                            <div className={`p-1 rounded-full bg-main/50 transition-transform inline-flex ${isExpanded ? 'rotate-180 text-white' : 'text-muted'}`}>
                              <ChevronDown size={12} />
                            </div>
                          </div>
                        </td>
                      </tr>

                      {/* --- NEW: Expanded Dropdown Row showing Buy Prices --- */}
                      {isExpanded && (
                        <tr className="bg-main/5">
                          {/* colSpan=8 spans the entire width of the table */}
                          <td colSpan={8} className="p-0 border-b border-subtle">
                            <div className="px-4 py-3 animate-in fade-in slide-in-from-top-2 duration-200">
                              <div className="text-[10px] text-muted uppercase tracking-widest font-bold mb-2 flex items-center gap-2">
                                <div className="w-1 h-1 rounded-full bg-up"></div>
                                Purchase Lots for {holding.asset}
                              </div>
                              
                              <div className="bg-panel rounded-md border border-main/50 overflow-hidden">
                                <div className="grid grid-cols-4 gap-4 px-3 py-1.5 bg-main/10 text-[10px] uppercase text-muted font-bold tracking-wider border-b border-main/50">
                                  <div>Date</div>
                                  <div className="text-right">Type</div>
                                  <div className="text-right">Amount</div>
                                  <div className="text-right">Price</div>
                                </div>
                                
                                {/* Mocking 2 lots based on the current holding's data */}
                                {[
                                  { date: '2024-02-14', type: 'Market Buy', qty: holding.quantity * 0.4, price: holding.avgPrice * 0.96 },
                                  { date: '2024-03-02', type: 'Limit Buy', qty: holding.quantity * 0.6, price: holding.avgPrice * 1.026 },
                                ].map((lot, idx) => (
                                  <div key={idx} className="grid grid-cols-4 gap-4 px-3 py-2 text-xs font-mono border-b border-main/20 last:border-0 hover:bg-main/20 transition-colors">
                                    <div className="text-main">{lot.date}</div>
                                    <div className="text-right text-up">{lot.type}</div>
                                    <div className="text-right text-main">{lot.qty.toFixed(4)} {holding.asset}</div>
                                    <div className="text-right text-main">₹{lot.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
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