import { useState, useRef, useCallback, useEffect } from 'react';
import { ChartPanel, OrderBook, Balances, OrderForm } from '../panels';
import { Maximize2, X } from 'lucide-react';

interface TradePageProps {
  darkMode: boolean;
}

export function TradePage({ darkMode }: TradePageProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [timeframe, setTimeframe] = useState('1m');

  // Custom Resizability
  const [leftWidth, setLeftWidth] = useState(20);
  const [rightWidth, setRightWidth] = useState(25);
  const [chartHeight, setChartHeight] = useState(70);
  const [orderFormHeight, setOrderFormHeight] = useState(70);

  const isResizing = useRef<string | null>(null);

  const startResizing = (type: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = type;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', stopResizing);
    document.body.style.cursor = type.includes('width') ? 'col-resize' : 'row-resize';
  };

  const stopResizing = useCallback(() => {
    isResizing.current = null;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', stopResizing);
    document.body.style.cursor = 'default';
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing.current) return;
    const { clientX, clientY } = e;
    const { innerWidth } = window;

    if (isResizing.current === 'left-width') {
      const newWidth = (clientX / innerWidth) * 100;
      if (newWidth > 10 && newWidth < 40) setLeftWidth(newWidth);
    } else if (isResizing.current === 'right-width') {
      const newWidth = ((innerWidth - clientX) / innerWidth) * 100;
      if (newWidth > 15 && newWidth < 40) setRightWidth(newWidth);
    } else if (isResizing.current === 'chart-height') {
      const container = document.getElementById('middle-panel');
      if (container) {
        const rect = container.getBoundingClientRect();
        const newHeight = ((clientY - rect.top) / rect.height) * 100;
        if (newHeight > 20 && newHeight < 80) setChartHeight(newHeight);
      }
    } else if (isResizing.current === 'order-form-height') {
      const container = document.getElementById('right-panel');
      if (container) {
        const rect = container.getBoundingClientRect();
        const newHeight = ((clientY - rect.top) / rect.height) * 100;
        if (newHeight > 20 && newHeight < 80) setOrderFormHeight(newHeight);
      }
    }
  }, []);

  useEffect(() => {
    return () => stopResizing();
  }, [stopResizing]);

  const middleWidth = 100 - leftWidth - rightWidth;
  const timeframes = ['1s', '5s', '1m', '5m', '1h', '1D'];

  return (
    <div className="flex w-full h-full gap-0 overflow-hidden select-none">
      {/* LEFT PANEL: Order Book */}
      <div
        style={{ width: `${leftWidth}%` }}
        className="hidden md:flex flex-col pr-[2px] h-full min-w-[150px]"
      >
        <div className="flex-1 glass-panel rounded-lg flex flex-col overflow-hidden">
          <div className="px-3 py-2 border-b border-main font-semibold text-sm">Order Book</div>
          <div className="flex-1 px-2 pt-2 overflow-hidden flex flex-col no-scrollbar">
            <OrderBook />
          </div>
        </div>
      </div>

      {/* Horizontal Divider 1 */}
      <div
        onMouseDown={startResizing('left-width')}
        className="w-1 shrink-0 hover:bg-panel cursor-col-resize transition-all hidden md:flex items-center justify-center group"
      >
        <div className="w-[1px] h-8 bg-panel/50" />
      </div>

      {/* MIDDLE PANEL: Chart & Positions */}
      <div
        id="middle-panel"
        style={{ width: `${middleWidth}%` }}
        className="flex flex-col px-[2px] h-full flex-1"
      >
        <div className="flex flex-col h-full overflow-hidden">
          {/* Chart Section */}
          <div
            style={{ height: isFullscreen ? '100vh' : `${chartHeight}%` }}
            className={`transition-all duration-300 ease-in-out ${isFullscreen ? "fixed inset-0 z-[100]" : "pb-[2px] shrink-0"}`}
          >
            <div className={`h-full flex flex-col overflow-hidden transition-all duration-300 ${isFullscreen ? 'rounded-none border-none bg-panel' : 'glass-panel rounded-lg'}`}>
              <div className="px-3 py-2 border-b border-main font-semibold text-sm flex items-center justify-between">
                <span className="flex items-center gap-2">
                  BTC/USD
                  <span className="text-up text-xs font-medium">+2.45%</span>
                </span>
                <div className="flex items-center gap-3">
                  <div className="flex gap-1 font-medium overflow-x-auto no-scrollbar">
                    {timeframes.map(tf => (
                      <button
                        key={tf}
                        onClick={() => setTimeframe(tf)}
                        className={`text-xs px-2 py-1 rounded transition-colors whitespace-nowrap ${tf === timeframe ? 'bg-panel border border-white/20 text-main' : 'hover:bg-panel text-muted hover:text-main'}`}
                      >
                        {tf}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setIsFullscreen(!isFullscreen)}
                    className="text-muted hover:text-main transition-colors p-1"
                    title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                  >
                    {isFullscreen ? <X size={16} /> : <Maximize2 size={16} />}
                  </button>
                </div>
              </div>
              <div className="flex-1 p-0 flex items-center justify-center relative bg-panel min-h-0">
                <ChartPanel darkMode={darkMode} timeframe={timeframe} />
              </div>
            </div>
          </div>

          {/* Vertical Divider 1 */}
          <div
            onMouseDown={startResizing('chart-height')}
            className="h-1 shrink-0 hover:bg-panel cursor-row-resize transition-all flex items-center justify-center group"
          >
            <div className="h-[1px] w-8 bg-panel/50" />
          </div>

          {/* Positions Section */}
          <div className="flex-1 min-h-0 pt-[2px]">
            <div className="h-full glass-panel rounded-lg flex flex-col overflow-hidden">
              <div className="px-3 py-2 border-b border-main font-semibold text-sm flex items-center justify-between">
                <span>Positions</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted font-normal">3 Open</span>
                  <button className="text-[10px] px-3 py-1.5 rounded-md bg-down text-white hover:brightness-110 transition-colors font-bold shadow-sm">Close All</button>
                </div>
              </div>
              <div className="flex-1 p-2 flex flex-col overflow-y-auto overflow-x-auto text-sm no-scrollbar">
                <table className="w-full text-left border-collapse min-w-[600px]">
                  <thead>
                    <tr className="text-muted border-b border-main/50 text-[10px] uppercase tracking-wider">
                      <th className="pb-2 font-medium">Symbol</th>
                      <th className="pb-2 font-medium">Side</th>
                      <th className="pb-2 font-medium">Size</th>
                      <th className="pb-2 font-medium">Entry Price</th>
                      <th className="pb-2 font-medium">Mark Price</th>
                      <th className="pb-2 font-medium text-right">PnL (ROE%)</th>
                      <th className="pb-2 font-medium text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-main/50">
                    {[
                      { symbol: 'BTC/USD', side: 'Long', size: '0.450', entry: '62,450.00', mark: '64,230.50', pnl: '+801.22', roe: '+3.2%', isPositive: true },
                      { symbol: 'ETH/USD', side: 'Short', size: '2.120', entry: '3,450.00', mark: '3,380.20', pnl: '+147.97', roe: '+2.1%', isPositive: true },
                      { symbol: 'SOL/USD', side: 'Long', size: '45.00', entry: '152.00', mark: '148.45', pnl: '-159.75', roe: '-2.4%', isPositive: false },
                    ].map((pos, i) => (
                      <tr key={i} className="group hover:bg-panel/50 transition-colors">
                        <td className="py-2.5 font-bold text-main">{pos.symbol}</td>
                        <td className={`py-2.5 ${pos.side === 'Long' ? 'text-up' : 'text-down'}`}>{pos.side}</td>
                        <td className="py-2.5 font-mono">{pos.size}</td>
                        <td className="py-2.5 font-mono text-muted">{pos.entry}</td>
                        <td className="py-2.5 font-mono text-muted">{pos.mark}</td>
                        <td className={`py-2.5 text-right font-mono font-bold ${pos.isPositive ? 'text-up' : 'text-down'}`}>
                          {pos.pnl} <span className="text-[10px] opacity-70 ml-1">({pos.roe})</span>
                        </td>
                        <td className="py-2.5 text-right">
                          <button className="text-[10px] px-3 py-1.5 rounded-md bg-down/20 text-down hover:bg-down/40 transition-colors font-bold shadow-sm">
                            Close
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Horizontal Divider 2 */}
      <div
        onMouseDown={startResizing('right-width')}
        className="w-1 shrink-0 hover:bg-panel cursor-col-resize transition-all hidden md:flex items-center justify-center group"
      >
        <div className="w-[1px] h-8 bg-panel/50" />
      </div>

      {/* RIGHT PANEL: Order Form & Balances */}
      <div
        id="right-panel"
        style={{ width: `${rightWidth}%` }}
        className="hidden md:flex flex-col pl-[2px] h-full min-w-[200px]"
      >
        <div className="flex flex-col h-full overflow-hidden">
          <div
            style={{ height: `${orderFormHeight}%` }}
            className="pb-[2px] shrink-0"
          >
            <div className="h-full glass-panel rounded-lg flex flex-col overflow-hidden">
              <OrderForm />
            </div>
          </div>

          {/* Vertical Divider 2 */}
          <div
            onMouseDown={startResizing('order-form-height')}
            className="h-1 shrink-0 hover:bg-panel cursor-row-resize transition-all flex items-center justify-center group"
          >
            <div className="h-[1px] w-8 bg-panel/50" />
          </div>

          <div className="flex-1 min-h-0 pt-[2px]">
            <div className="h-full glass-panel rounded-lg flex flex-col overflow-hidden">
              <Balances />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
