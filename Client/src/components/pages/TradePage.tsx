import { useState, useRef, useCallback, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { ChartPanel, OrderBook, Balances, OrderForm } from '../panels';
import { Maximize2, X } from 'lucide-react';
import { DashboardContextType } from '../layouts/Layout';

interface TradePageProps {
  darkMode: boolean;
}

export function TradePage({ darkMode }: TradePageProps) {
  // 1. Grab all our dynamic data from the Layout context
  const { activeSymbol, markets, positions } = useOutletContext<DashboardContextType>();

  // 2. Find the currently active market so we can display its % change
  // Fallback to the first market just in case it's still loading
  const activeIndexData = markets.find(m => m.symbol === activeSymbol) || markets[0];
  
  // NEW: Extract the current price from your market data. 
  // Change '.price' if your backend uses a different key (like .lastPrice or .markPrice)
  const currentMarketPrice = Number(activeIndexData?.price) || 0; 

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [timeframe, setTimeframe] = useState('1s');

  // Custom Resizability State
  const [leftWidth, setLeftWidth] = useState(280);
  const [rightWidth, setRightWidth] = useState(320);
  const [chartHeight, setChartHeight] = useState(70);
  const [orderFormHeight, setOrderFormHeight] = useState(70);

  const [isHorizontal, setIsHorizontal] = useState(
    typeof window !== 'undefined' 
      ? window.innerWidth >= 768 && window.innerWidth > window.innerHeight 
      : true
  );

  useEffect(() => {
    const handleResize = () => setIsHorizontal(window.innerWidth >= 768 && window.innerWidth > window.innerHeight);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isResizing = useRef<string | null>(null);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing.current) return;
    const { clientX, clientY } = e;
    const { innerWidth } = window;

    if (isResizing.current === 'left-width') {
      const newWidth = Math.max(150, Math.min(clientX, 600));
      setLeftWidth(newWidth);
    } else if (isResizing.current === 'right-width') {
      const newWidth = Math.max(200, Math.min(innerWidth - clientX, 600));
      setRightWidth(newWidth);
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

  const stopResizing = useCallback(() => {
    isResizing.current = null;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', stopResizing);
    document.body.style.cursor = 'default';
  }, [handleMouseMove]);

  const startResizing = useCallback((type: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = type;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', stopResizing);
    document.body.style.cursor = type.includes('width') ? 'col-resize' : 'row-resize';
  }, [handleMouseMove, stopResizing]);

  useEffect(() => {
    return () => stopResizing();
  }, [stopResizing]);

  const timeframes = ['1s', '5s'];

  return (
    <div className={`flex w-full h-full gap-0 select-none ${isHorizontal ? 'flex-row overflow-hidden' : 'flex-col overflow-y-auto'}`}>
      {/* LEFT PANEL: Order Book */}
      <div
        style={{ width: isHorizontal ? `${leftWidth}px` : '100%' }}
        className={`flex flex-col min-w-[150px] shrink-0 ${isHorizontal ? 'pr-[2px] h-full order-none mt-0' : 'h-[400px] order-3 mt-[2px]'}`}
      >
        <div className="flex-1 glass-panel rounded-lg flex flex-col overflow-hidden">
          <div className="px-3 py-2 border-b border-main font-semibold text-sm">
            Order Book ({activeIndexData?.displaySymbol || activeSymbol})
          </div>
          <div className="flex-1 px-2 pt-2 overflow-hidden flex flex-col no-scrollbar">
            <OrderBook symbol={activeSymbol} />
          </div>
        </div>
      </div>

      {/* Horizontal Divider 1 */}
      <div
        onMouseDown={startResizing('left-width')}
        className={`w-1 shrink-0 hover:bg-panel cursor-col-resize transition-all items-center justify-center group ${isHorizontal ? 'flex' : 'hidden'}`}
      >
        <div className="w-[1px] h-8 bg-panel/50" />
      </div>

      {/* MIDDLE PANEL: Chart & Positions */}
      <div
        id="middle-panel"
        style={{ width: isHorizontal ? `calc(100% - ${leftWidth + rightWidth}px - 8px)` : '100%' }}
        className={`flex flex-col flex-1 min-w-0 ${isHorizontal ? 'px-[2px] h-full order-none' : 'h-auto order-1'}`}
      >
        <div className="flex flex-col h-full overflow-hidden">
          {/* Chart Section */}
          <div
            style={{ height: isFullscreen ? '100vh' : (isHorizontal ? `${chartHeight}%` : '400px') }}
            className={`transition-all duration-300 ease-in-out ${isFullscreen ? "fixed inset-0 z-[100]" : "pb-[2px] shrink-0"}`}
          >
            <div className={`h-full flex flex-col overflow-hidden transition-all duration-300 ${isFullscreen ? 'rounded-none border-none bg-panel' : 'glass-panel rounded-lg'}`}>
              <div className="px-3 py-2 border-b border-main font-semibold text-sm flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-bold">{activeIndexData?.displaySymbol || activeSymbol}</span>
                  {activeIndexData && (
                    <span className={`text-xs font-medium ${activeIndexData.isPositive ? 'text-up' : 'text-down'}`}>
                      {activeIndexData.change}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex gap-1 font-medium overflow-x-auto no-scrollbar">
                    {timeframes.map(tf => (
                      <button
                        key={tf}
                        onClick={() => setTimeframe(tf)}
                        className={`text-xs px-2 py-1 rounded transition-colors whitespace-nowrap ${tf === timeframe ? 'bg-black/50 border border-white/20 text-main' : 'hover:bg-panel text-muted hover:text-main'}`}
                      >
                        {tf}
                      </button>
                    ))}
                  </div>
                  <button onClick={() => setIsFullscreen(!isFullscreen)} className="text-muted hover:text-main transition-colors p-1" title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}>
                    {isFullscreen ? <X size={16} /> : <Maximize2 size={16} />}
                  </button>
                </div>
              </div>
              <div className="flex-1 p-0 flex items-center justify-center relative bg-panel min-h-0">
                <ChartPanel darkMode={darkMode} timeframe={timeframe} symbol={activeSymbol} />
              </div>
            </div>
          </div>

          {/* Vertical Divider 1 */}
          <div
            onMouseDown={startResizing('chart-height')}
            className={`h-1 shrink-0 hover:bg-panel cursor-row-resize transition-all items-center justify-center group ${isHorizontal ? 'flex' : 'hidden'}`}
          >
            <div className="h-[1px] w-8 bg-panel/50" />
          </div>

          {/* Positions Section */}
          <div className={`flex-1 shrink-0 ${isHorizontal ? 'min-h-0 pt-0' : 'min-h-[250px] pt-[2px]'}`}>
            <div className="h-full glass-panel rounded-lg flex flex-col overflow-hidden">
              <div className="px-3 py-2 border-b border-main font-semibold text-sm flex items-center justify-between">
                <span>Positions</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted font-normal">{positions.length} Open</span>
                  {positions.length > 0 && (
                    <button className="text-[10px] px-3 py-1.5 rounded-md bg-down text-white hover:brightness-110 transition-colors font-bold shadow-sm">
                      Close All
                    </button>
                  )}
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
                    {positions.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-muted">No open positions</td>
                      </tr>
                    ) : (
                      positions.map((pos) => (
                        <tr 
                          key={pos.id} 
                          className={`group transition-colors ${pos.symbol === activeSymbol ? 'bg-panel/80' : 'hover:bg-panel/50'}`}
                        >
                          <td className="py-2.5 font-bold text-main">
                            {pos.symbol}
                            {pos.symbol === activeSymbol && <span className="ml-2 text-[10px] text-muted">(Active)</span>}
                          </td>
                          <td className={`py-2.5 ${pos.side === 'Long' ? 'text-up' : 'text-down'}`}>{pos.side}</td>
                          <td className="py-2.5 font-mono">{pos.size}</td>
                          <td className="py-2.5 font-mono text-muted">{pos.entryPrice}</td>
                          <td className="py-2.5 font-mono text-muted">{pos.markPrice}</td>
                          <td className={`py-2.5 text-right font-mono font-bold ${pos.isPositive ? 'text-up' : 'text-down'}`}>
                            {pos.pnl} <span className="text-[10px] opacity-70 ml-1">({pos.roe})</span>
                          </td>
                          <td className="py-2.5 text-right">
                            <button className="text-[10px] px-3 py-1.5 rounded-md bg-down/20 text-down hover:bg-down/40 transition-colors font-bold shadow-sm">
                              Close
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
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
        className={`w-1 shrink-0 hover:bg-panel cursor-col-resize transition-all items-center justify-center group ${isHorizontal ? 'flex' : 'hidden'}`}
      >
        <div className="w-[1px] h-8 bg-panel/50" />
      </div>

      {/* RIGHT PANEL: Order Form & Balances */}
      <div
        id="right-panel"
        style={{ width: isHorizontal ? `${rightWidth}px` : '100%' }}
        className={`flex flex-col min-w-[200px] shrink-0 ${isHorizontal ? 'pl-[2px] h-full order-none mt-0' : 'h-auto order-2 mt-[2px]'}`}
      >
        <div className="flex flex-col h-full overflow-hidden">
          <div
            style={{ height: isHorizontal ? `${orderFormHeight}%` : 'auto' }}
            className={`pb-[2px] shrink-0 ${isHorizontal ? 'min-h-0' : 'min-h-[350px]'}`}
          >
            <div className="h-full glass-panel rounded-lg flex flex-col overflow-hidden">
              {/* CRITICAL: Passed currentMarketPrice down alongside symbol */}
              <OrderForm symbol={activeSymbol} currentPrice={currentMarketPrice} />
            </div>
          </div>

          {/* Vertical Divider 2 */}
          <div
            onMouseDown={startResizing('order-form-height')}
            className={`h-1 shrink-0 hover:bg-panel cursor-row-resize transition-all items-center justify-center group ${isHorizontal ? 'flex' : 'hidden'}`}
          >
            <div className="h-[1px] w-8 bg-panel/50" />
          </div>

          <div className={`flex-1 shrink-0 ${isHorizontal ? 'min-h-0 pt-0' : 'min-h-[200px] pt-[2px]'}`}>
            <div className="h-full glass-panel rounded-lg flex flex-col overflow-hidden">
              <Balances />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}