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
  { id: 1, symbol: 'BTC/USD', side: 'Buy', price: 62450, quantity: 0.45, total: 28102.50, pnl: 801.22, date: '2024-03-24', time: '14:32' },
  { id: 2, symbol: 'ETH/USD', side: 'Sell', price: 3450, quantity: 2.12, total: 7314.00, pnl: 147.97, date: '2024-03-23', time: '09:15' },
  { id: 3, symbol: 'SOL/USD', side: 'Buy', price: 152, quantity: 45, total: 6840.00, pnl: -159.75, date: '2024-03-22', time: '16:48' },
  { id: 4, symbol: 'BTC/USD', side: 'Sell', price: 63100, quantity: 0.25, total: 15775.00, pnl: 520.40, date: '2024-03-21', time: '11:22' },
  { id: 5, symbol: 'AVAX/USD', side: 'Buy', price: 28, quantity: 80, total: 2240.00, pnl: 608.00, date: '2024-03-20', time: '08:05' },
  { id: 6, symbol: 'LINK/USD', side: 'Buy', price: 12, quantity: 150, total: 1800.00, pnl: 427.50, date: '2024-03-19', time: '13:40' },
  { id: 7, symbol: 'ETH/USD', side: 'Buy', price: 3280, quantity: 3.5, total: 11480.00, pnl: 350.70, date: '2024-03-18', time: '10:12' },
  { id: 8, symbol: 'SOL/USD', side: 'Sell', price: 145, quantity: 20, total: 2900.00, pnl: -85.00, date: '2024-03-17', time: '15:33' },
  { id: 9, symbol: 'BTC/USD', side: 'Buy', price: 61200, quantity: 0.15, total: 9180.00, pnl: 454.58, date: '2024-03-16', time: '07:55' },
  { id: 10, symbol: 'DOT/USD', side: 'Buy', price: 7.20, quantity: 200, total: 1440.00, pnl: -76.00, date: '2024-03-15', time: '12:18' },
];

export function HistoryPage() {
  const [filter, setFilter] = useState<'all' | 'buys' | 'sells'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  const filteredTrades = TRADE_HISTORY.filter(t => {
    if (searchQuery && !t.symbol.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (filter === 'buys') return t.side === 'Buy';
    if (filter === 'sells') return t.side === 'Sell';
    if (dateFilter && t.date !== dateFilter) return false;
    return true;
  });

  const handleExport = () => {
    alert('Exporting CSV... (Simulated)');
  };

  const totalPnL = filteredTrades.reduce((sum, t) => sum + t.pnl, 0);
  const wins = filteredTrades.filter(t => t.pnl > 0).length;
  const losses = filteredTrades.filter(t => t.pnl < 0).length;

  return (
    <div className="flex flex-col w-full h-full gap-0 overflow-hidden select-none p-0 font-sans focus:outline-none focus:ring-0">
      {/* Summary Cards Row with spacing */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 shrink-0 p-4 pb-0">
        <div className="glass-panel rounded-xl p-5 shadow-lg border border-main">
          <div className="text-[10px] text-muted uppercase tracking-wider font-bold mb-2 flex items-center gap-1.5"><ArrowUpRight size={14}/> Total P&L</div>
          <div className={`text-2xl font-bold font-mono ${totalPnL >= 0 ? 'text-up' : 'text-down'}`}>
            {totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)}
          </div>
        </div>
        <div className="glass-panel rounded-xl p-5 shadow-lg border border-main">
          <div className="text-[10px] text-muted uppercase tracking-wider font-bold mb-2 flex items-center gap-1.5"><Filter size={14}/> Winning Trades</div>
          <div className="text-2xl font-bold text-up font-mono">{wins}</div>
        </div>
        <div className="glass-panel rounded-xl p-5 shadow-lg border border-main">
          <div className="text-[10px] text-muted uppercase tracking-wider font-bold mb-2 flex items-center gap-1.5"><ArrowDownRight size={14}/> Losing Trades</div>
          <div className="text-2xl font-bold text-down font-mono">{losses}</div>
        </div>
      </div>

      {/* Trade History Table: Flush Panel like TradePage */}
      <div className="flex-1 glass-panel rounded-none flex flex-col overflow-hidden shadow-none border-none border-t border-main mt-4">
        <div className="px-5 py-4 border-b border-main flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-panel">
          <span className="font-semibold text-lg font-display">Trade History ({filteredTrades.length} trades)</span>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full md:w-auto">
            <div className="flex items-center bg-panel/50 rounded-lg px-3 py-2 border border-main gap-2 flex-1 sm:flex-none focus-within:border-white transition-colors">
              <Search size={14} className="text-muted" />
              <input
                type="text"
                placeholder="Search symbol..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="bg-transparent text-main text-sm outline-none w-full sm:w-32 placeholder:text-muted"
              />
            </div>
            <div className="flex items-center bg-panel/50 rounded-lg px-3 py-2 border border-main gap-2 flex-1 sm:flex-none focus-within:border-white transition-colors">
              <Calendar size={14} className="text-muted" />
              <input
                type="date"
                value={dateFilter}
                onChange={e => setDateFilter(e.target.value)}
                className="bg-transparent text-main text-sm outline-none w-full sm:w-auto placeholder:text-muted cursor-pointer"
              />
            </div>
            <div className="flex gap-2 bg-main p-1 rounded-lg border border-main">
              {(['all', 'buys', 'sells'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`text-xs uppercase font-bold px-4 py-1.5 rounded-md transition-all ${
                    filter === f ? 'bg-panel shadow text-main' : 'text-muted hover:text-main'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
            <button 
              onClick={handleExport}
              className="flex items-center gap-2 bg-main hover:bg-panel border border-main hover:border-white/50 transition-colors px-4 py-2 rounded-lg text-sm font-bold text-main"
            >
              <Download size={14} /> Output CSV
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto no-scrollbar">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-panel z-10">
              <tr className="text-muted border-b border-main/50 text-xs uppercase tracking-wider bg-panel/80 backdrop-blur-sm">
                <th className="pb-3 pt-4 px-5 font-medium">Date</th>
                <th className="pb-3 pt-4 px-4 font-medium">Symbol</th>
                <th className="pb-3 pt-4 px-4 font-medium">Side</th>
                <th className="pb-3 pt-4 px-4 font-medium text-right">Price</th>
                <th className="pb-3 pt-4 px-4 font-medium text-right hidden sm:table-cell">Quantity</th>
                <th className="pb-3 pt-4 px-4 font-medium text-right hidden md:table-cell">Total</th>
                <th className="pb-3 pt-4 px-5 font-medium text-right">P&L</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-main/50">
              {filteredTrades.map(trade => (
                <tr key={trade.id} className="hover:bg-main/30 transition-colors group">
                  <td className="py-4 px-5 text-muted">
                    <div className="text-sm font-medium">{trade.date}</div>
                    <div className="text-xs text-muted/70 font-mono mt-0.5">{trade.time}</div>
                  </td>
                  <td className="py-4 px-4 font-bold text-main text-base">{trade.symbol}</td>
                  <td className="py-4 px-4">
                    <div className={`flex items-center gap-1.5 font-bold px-2 py-1 rounded-md w-fit ${trade.side === 'Buy' ? 'text-up bg-up/10' : 'text-down bg-down/10'}`}>
                      {trade.side === 'Buy' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                      {trade.side}
                    </div>
                  </td>
                  <td className="py-4 px-4 font-mono text-right text-main font-semibold text-base">
                    ${trade.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-4 px-4 font-mono text-right text-muted hidden sm:table-cell text-sm">{trade.quantity}</td>
                  <td className="py-4 px-4 font-mono text-right text-muted hidden md:table-cell text-sm">
                    ${trade.total.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </td>
                  <td className={`py-4 px-5 font-mono text-right font-bold text-base ${trade.pnl >= 0 ? 'text-up' : 'text-down'}`}>
                    {trade.pnl >= 0 ? '+' : ''}${Math.abs(trade.pnl).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
