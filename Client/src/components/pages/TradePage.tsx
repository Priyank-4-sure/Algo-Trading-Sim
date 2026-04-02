import { useState, useRef, useCallback, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { ChartPanel, OrderBook, Balances, OrderForm } from '../panels';
import { Maximize2, X, ChevronDown } from 'lucide-react';
import { DashboardContextType } from '../layouts/Layout';

interface TradePageProps {
  darkMode: boolean;
}

export function TradePage({ darkMode }: TradePageProps) {
  // 1. Grab all our dynamic data from the Layout context
  const { activeSymbol, setActiveSymbol, markets, positions } = useOutletContext<DashboardContextType>();

  // 2. Find the currently active market so we can display its % change
  // Fallback to the first market just in case it's still loading
  const activeIndexData = markets.find(m => m.symbol === activeSymbol) || markets[0];
  
  // NEW: Extract the current price from your market data. 
  // Change '.price' if your backend uses a different key (like .lastPrice or .markPrice)
  const currentMarketPrice = Number(activeIndexData?.price) || 0; 

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [timeframe, setTimeframe] = useState('1m');

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
  const timeframes = ['1s', '5s'];

  return (
    <div className="flex w-full h-full gap-0 overflow-hidden select-none">
      {/* LEFT PANEL */}
      <div style={{ width: `${leftWidth}%` }} className="hidden md:flex flex-col pr-[2px] h-full min-w-[150px]">
        <div className="flex-1 glass-panel rounded-lg flex flex-col overflow-hidden">
          <div className="px-3 py-2 border-b border-main font-semibold text-sm">
            Order Book ({activeIndexData?.displaySymbol || activeSymbol})
          </div>
          <div className="flex-1 px-2 pt-2 overflow-hidden flex flex-col no-scrollbar">
            <OrderBook symbol={activeSymbol} />
          </div>
        </div>
      </div>

      <div onMouseDown={startResizing('left-width')} className="w-1 shrink-0 hover:bg-panel cursor-col-resize transition-all hidden md:flex items-center justify-center group">
        <div className="w-[1px] h-8 bg-panel/50" />
      </div>

      {/* MIDDLE PANEL */}
      <div id="middle-panel" style={{ width: `${middleWidth}%` }} className="flex flex-col px-[2px] h-full flex-1">
        <div className="flex flex-col h-full overflow-hidden">
          {/* Chart Section */}
          <div style={{ height: isFullscreen ? '100vh' : `${chartHeight}%` }} className={`transition-all duration-300 ease-in-out ${isFullscreen ? "fixed inset-0 z-[100]" : "pb-[2px] shrink-0"}`}>
            <div className={`h-full flex flex-col overflow-hidden transition-all duration-300 ${isFullscreen ? 'rounded-none border-none bg-panel' : 'glass-panel rounded-lg'}`}>
              <div className="px-3 py-2 border-b border-main font-semibold text-sm flex items-center justify-between">
                <div className="flex items-center gap-2 relative group cursor-pointer">
                  <select
                    value={activeSymbol}
                    onChange={(e) => setActiveSymbol(e.target.value)}
                    className="appearance-none bg-transparent hover:bg-panel/50 outline-none pr-6 py-1 pl-2 rounded cursor-pointer font-bold"
                  >
                    {markets.map(market => (
                      <option key={market.symbol} value={market.symbol} className="bg-background text-foreground">
                        {market.displaySymbol}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-2 pointer-events-none text-muted" />
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
                        className={`text-xs px-2 py-1 rounded transition-colors whitespace-nowrap ${tf === timeframe ? 'bg-panel border border-white/20 text-main' : 'hover:bg-panel text-muted hover:text-main'}`}
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

          <div onMouseDown={startResizing('chart-height')} className="h-1 shrink-0 hover:bg-panel cursor-row-resize transition-all flex items-center justify-center group">
            <div className="h-[1px] w-8 bg-panel/50" />
          </div>

          {/* Positions Section */}
          <div className="flex-1 min-h-0 pt-[2px]">
             {/* ... (Positions rendering remains exactly the same as your code) ... */}
          </div>
        </div>
      </div>

      <div onMouseDown={startResizing('right-width')} className="w-1 shrink-0 hover:bg-panel cursor-col-resize transition-all hidden md:flex items-center justify-center group">
        <div className="w-[1px] h-8 bg-panel/50" />
      </div>

      {/* RIGHT PANEL */}
      <div id="right-panel" style={{ width: `${rightWidth}%` }} className="hidden md:flex flex-col pl-[2px] h-full min-w-[200px]">
        <div className="flex flex-col h-full overflow-hidden">
          <div style={{ height: `${orderFormHeight}%` }} className="pb-[2px] shrink-0">
            <div className="h-full glass-panel rounded-lg flex flex-col overflow-hidden">
              {/* CRITICAL: Passed currentMarketPrice down alongside symbol */}
              <OrderForm symbol={activeSymbol} currentPrice={currentMarketPrice} />
            </div>
          </div>

          <div onMouseDown={startResizing('order-form-height')} className="h-1 shrink-0 hover:bg-panel cursor-row-resize transition-all flex items-center justify-center group">
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