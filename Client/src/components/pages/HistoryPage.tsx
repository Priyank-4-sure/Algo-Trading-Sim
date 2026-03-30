import { useState } from 'react';
import { ArrowUpRight, ArrowDownRight, Search, Download, Calendar, Filter } from 'lucide-react';

interface TradeRecord {
  id: number;
  symbol: string;
  side: 'Buy' | 'Sell';
  price: number;
  quantity: number;
  total: number;
  pnl: number;
  date: string;
  time: string;
}

const TRADE_HISTORY: TradeRecord[] = [
  { id: 1, symbol: 'BTC/INR', side: 'Buy', price: 62450, quantity: 0.45, total: 28102.50, pnl: 801.22, date: '2024-03-24', time: '14:32' },
  { id: 2, symbol: 'ETH/INR', side: 'Sell', price: 3450, quantity: 2.12, total: 7314.00, pnl: 147.97, date: '2024-03-23', time: '09:15' },
  { id: 3, symbol: 'SOL/INR', side: 'Buy', price: 152, quantity: 45, total: 6840.00, pnl: -159.75, date: '2024-03-22', time: '16:48' },
  { id: 4, symbol: 'BTC/INR', side: 'Sell', price: 63100, quantity: 0.25, total: 15775.00, pnl: 520.40, date: '2024-03-21', time: '11:22' },
  { id: 5, symbol: 'AVAX/INR', side: 'Buy', price: 28, quantity: 80, total: 2240.00, pnl: 608.00, date: '2024-03-20', time: '08:05' },
  { id: 6, symbol: 'LINK/INR', side: 'Buy', price: 12, quantity: 150, total: 1800.00, pnl: 427.50, date: '2024-03-19', time: '13:40' },
  { id: 7, symbol: 'ETH/INR', side: 'Buy', price: 3280, quantity: 3.5, total: 11480.00, pnl: 350.70, date: '2024-03-18', time: '10:12' },
  { id: 8, symbol: 'SOL/INR', side: 'Sell', price: 145, quantity: 20, total: 2900.00, pnl: -85.00, date: '2024-03-17', time: '15:33' },
  { id: 9, symbol: 'BTC/INR', side: 'Buy', price: 61200, quantity: 0.15, total: 9180.00, pnl: 454.58, date: '2024-03-16', time: '07:55' },
  { id: 10, symbol: 'DOT/INR', side: 'Buy', price: 7.20, quantity: 200, total: 1440.00, pnl: -76.00, date: '2024-03-15', time: '12:18' },
];

export function HistoryPage() {
  const [filter, setFilter] = useState<'all' | 'buys' | 'sells'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  const filteredTrades = TRADE_HISTORY.filter(t => {
    // Better search: checks symbol, side, or the DD/MM/YYYY formatted date
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const formattedDate = t.date.split('-').reverse().join('/');
      if (!t.symbol.toLowerCase().includes(q) && !t.side.toLowerCase().includes(q) && !formattedDate.includes(q)) return false;
    }
    
    if (filter === 'buys') return t.side === 'Buy';
    if (filter === 'sells') return t.side === 'Sell';
    if (dateFilter && t.date !== dateFilter) return false;
    return true;
  });

  const handleExport = () => {
    // Minimalist CSV Export
    const csv = ['Date,Symbol,Side,Price,Qty,Total,P&L']
      .concat(filteredTrades.map(t => `${t.date.split('-').reverse().join('/')},${t.symbol},${t.side},${t.price},${t.quantity},${t.total},${t.pnl}`))
      .join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    link.download = 'trade_history.csv';
    link.click();
  };

  const totalPnL = filteredTrades.reduce((sum, t) => sum + t.pnl, 0);
  const wins = filteredTrades.filter(t => t.pnl > 0).length;
  const losses = filteredTrades.filter(t => t.pnl < 0).length;

  return (
    <div className="flex flex-col w-full h-full gap-0 overflow-hidden select-none font-sans">
      {/* Summary Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-0 shrink-0 pb-[2px]">
        <div className="pr-0.5">
          <div className="glass-panel rounded-lg p-3 h-full">
            <div className="text-[10px] text-muted uppercase tracking-wider font-bold mb-1 flex items-center gap-1"><ArrowUpRight size={12}/> Total P&L</div>
            <div className={`text-xl font-bold font-mono ${totalPnL >= 0 ? 'text-up' : 'text-down'}`}>
              {totalPnL >= 0 ? '+' : ''}₹{totalPnL.toFixed(2)}
            </div>
          </div>
        </div>
        <div className="px-0.5">
          <div className="glass-panel rounded-lg p-3 h-full">
            <div className="text-[10px] text-muted uppercase tracking-wider font-bold mb-1 flex items-center gap-1"><Filter size={12}/> Winning Trades</div>
            <div className="text-xl font-bold text-up font-mono">{wins}</div>
          </div>
        </div>
        <div className="pl-0.5">
          <div className="glass-panel rounded-lg p-3 h-full">
            <div className="text-[10px] text-muted uppercase tracking-wider font-bold mb-1 flex items-center gap-1"><ArrowDownRight size={12}/> Losing Trades</div>
            <div className="text-xl font-bold text-down font-mono">{losses}</div>
          </div>
        </div>
      </div>

      {/* Trade History Table */}
      <div className="flex-1 pt-1">
        <div className="glass-panel rounded-lg flex flex-col overflow-hidden h-full">
          <div className="px-3 py-2 border-b border-main flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
            <span className="font-semibold text-sm">Trade History ({filteredTrades.length} trades)</span>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full md:w-auto">
              <div className="flex items-center bg-main/50 rounded px-2 py-1 border border-main gap-1.5 flex-1 sm:flex-none focus-within:border-white/50 transition-colors">
                <Search size={12} className="text-muted" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="bg-transparent text-main text-sm outline-none w-full sm:w-24 placeholder:text-muted"
                />
              </div>
              <div className="flex items-center bg-main/50 rounded px-2 py-1 border border-main gap-1.5 flex-1 sm:flex-none focus-within:border-white/50 transition-colors">
                <Calendar size={12} className="text-muted" />
                <input
                  type="date"
                  value={dateFilter}
                  onChange={e => setDateFilter(e.target.value)}
                  className="bg-transparent text-main text-sm outline-none w-full sm:w-auto placeholder:text-muted cursor-pointer"
                />
              </div>
              <div className="flex gap-1">
                {(['all', 'buys', 'sells'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`text-xs uppercase font-bold px-2 py-1 rounded transition-all ${
                      filter === f ? 'bg-panel border border-white/20 text-main' : 'text-muted hover:text-main hover:bg-panel'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
              <button
                onClick={handleExport}
                className="flex items-center gap-1 bg-main/50 hover:bg-panel border border-main hover:border-white/30 transition-colors px-2 py-1 rounded text-sm font-bold text-main"
              >
                <Download size={12} /> CSV
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto no-scrollbar">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-panel z-10">
                <tr className="text-muted border-b border-subtle text-[10px] uppercase tracking-wider">
                  <th className="pb-2 pt-2 px-3 font-medium">Date</th>
                  <th className="pb-2 pt-2 px-2 font-medium">Symbol</th>
                  <th className="pb-2 pt-2 px-2 font-medium">Side</th>
                  <th className="pb-2 pt-2 px-2 font-medium text-right">Price</th>
                  <th className="pb-2 pt-2 px-2 font-medium text-right hidden sm:table-cell">Qty</th>
                  <th className="pb-2 pt-2 px-2 font-medium text-right hidden md:table-cell">Total</th>
                  <th className="pb-2 pt-2 px-3 font-medium text-right">P&L</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-subtle">
                {filteredTrades.map(trade => (
                  <tr key={trade.id} className="hover:bg-main/30 transition-colors group">
                    <td className="py-2 px-3 text-muted">
                      {/* Formatted to DD/MM/YYYY inline here */}
                      <div className="text-sm font-medium">{trade.date.split('-').reverse().join('/')}</div>
                      <div className="text-[10px] text-muted/70 font-mono">{trade.time}</div>
                    </td>
                    <td className="py-2 px-2 font-bold text-main text-sm">{trade.symbol}</td>
                    <td className="py-2 px-2">
                      <div className={`flex items-center gap-1 font-bold px-1.5 py-0.5 rounded w-fit text-[10px] ${trade.side === 'Buy' ? 'text-up bg-up/10' : 'text-down bg-down/10'}`}>
                        {trade.side === 'Buy' ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                        {trade.side}
                      </div>
                    </td>
                    <td className="py-2 px-2 font-mono text-right text-main font-semibold text-sm">
                      ₹{trade.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-2 px-2 font-mono text-right text-muted hidden sm:table-cell text-sm">{trade.quantity}</td>
                    <td className="py-2 px-2 font-mono text-right text-muted hidden md:table-cell text-sm">
                      ₹{trade.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    <td className={`py-2 px-3 font-mono text-right font-bold text-sm ${trade.pnl >= 0 ? 'text-up' : 'text-down'}`}>
                      {trade.pnl >= 0 ? '+' : ''}₹{Math.abs(trade.pnl).toFixed(2)}
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