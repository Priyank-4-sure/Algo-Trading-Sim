import { createChart, IChartApi, CrosshairMode, LineStyle } from 'lightweight-charts';
import { useEffect, useRef, useState, useCallback } from 'react';
import { Crosshair, Type, Minus, BarChart2, Grid } from 'lucide-react';
import { useTradeWebSocket } from '../../hooks/useTrade';

interface ChartPanelProps {
  darkMode: boolean;
  timeframe?: string;
  symbol: string;
}

export function ChartPanel({ darkMode, timeframe = '1s', symbol }: ChartPanelProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef          = useRef<IChartApi | null>(null);
  const seriesRef         = useRef<any>(null);
  const volumeSeriesRef   = useRef<any>(null);

  const [activeTool, setActiveTool] = useState<'cursor' | 'text' | 'priceLine'>('cursor');
  const [chartType,  setChartType]  = useState<'candlestick' | 'line'>('candlestick');
  const [showGrid,   setShowGrid]   = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const activeToolRef = useRef(activeTool);
  useEffect(() => { activeToolRef.current = activeTool; }, [activeTool]);

  const markersRef     = useRef<any[]>([]);
  const allCandlesRef  = useRef<any[]>([]); // Full history received on WS connect
  const loadedCountRef = useRef(0);         // How many candles are currently rendered
  const isFetchingRef  = useRef(false);     // Debounce guard

  // ---- Live-data handler (WS hook calls this) ----
  const handleLiveTick = useCallback((liveData: any, isHistorical: boolean) => {
    if (!seriesRef.current || !liveData) return;

    // 10-minute window: 600 bars @ 1s, 120 bars @ 5s
    const chunkSize = timeframe === '5s' ? 120 : 600;

    try {
      if (isHistorical && Array.isArray(liveData)) {
        // Store the full history in memory, render only the last 10 minutes initially
        allCandlesRef.current  = liveData;

        const toTime  = (c: any) => Math.floor(new Date(c.bucket_time).getTime() / 1000) as any;
        const initial = liveData.slice(-chunkSize);

        if (chartType === 'candlestick') {
          seriesRef.current.setData(initial.map((c: any) => ({
            time: toTime(c), open: c.open, high: c.high, low: c.low, close: c.close,
          })));
        } else {
          seriesRef.current.setData(initial.map((c: any) => ({
            time: toTime(c), value: c.close,
          })));
        }

        volumeSeriesRef.current?.setData(initial.map((c: any) => ({
          time:  toTime(c),
          value: c.volume,
          color: c.close >= c.open ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)',
        })));

        loadedCountRef.current = initial.length;
        return;
      }

      // Live tick — update the in-progress candle
      const t = Math.floor(new Date(liveData.bucket_time).getTime() / 1000);

      if (chartType === 'candlestick') {
        seriesRef.current.update({
          time: t as any, open: liveData.open, high: liveData.high, low: liveData.low, close: liveData.close,
        });
      } else {
        seriesRef.current.update({ time: t as any, value: liveData.close });
      }

      volumeSeriesRef.current?.update({
        time: t as any, value: liveData.volume,
        color: liveData.close >= liveData.open ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)',
      });
    } catch (err) {
      console.error('Chart update failed:', err);
    }
  }, [chartType, timeframe]);

  useTradeWebSocket(symbol, timeframe, handleLiveTick);

  // ---- Create / recreate chart ----
  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Reset state for new chart instance
    markersRef.current     = [];
    allCandlesRef.current  = [];
    loadedCountRef.current = 0;
    isFetchingRef.current  = false;

    const chunkSize = timeframe === '5s' ? 120 : 600;
    const gridColor = showGrid ? (darkMode ? '#1E1E1E' : '#e0e0e0') : 'transparent';

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: 'transparent' },
        textColor: darkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
      },
      grid: {
        vertLines: { color: gridColor, style: LineStyle.Solid },
        horzLines: { color: gridColor, style: LineStyle.Solid },
      },
      timeScale: {
        borderColor: darkMode ? '#1E1E1E' : '#e0e0e0',
        timeVisible: true,
        secondsVisible: true,
      },
      rightPriceScale: { borderColor: darkMode ? '#1E1E1E' : '#e0e0e0' },
      crosshair: { mode: CrosshairMode.Normal },
      autoSize: true,
    });

    chartRef.current = chart;

    let mainSeries: any;
    if (chartType === 'candlestick') {
      mainSeries = chart.addCandlestickSeries({
        upColor:       darkMode ? '#22c55e' : '#16a34a',
        downColor:     darkMode ? '#ef4444' : '#dc2626',
        borderVisible: false,
        wickUpColor:   darkMode ? '#22c55e' : '#16a34a',
        wickDownColor: darkMode ? '#ef4444' : '#dc2626',
      });
    } else {
      mainSeries = chart.addLineSeries({ color: darkMode ? '#ffffff' : '#111111', lineWidth: 2 });
    }
    seriesRef.current = mainSeries;

    const volSeries = chart.addHistogramSeries({
      color: '#26a69a', priceFormat: { type: 'volume' }, priceScaleId: '',
    });
    volumeSeriesRef.current = volSeries;
    chart.priceScale('').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });

    mainSeries.setData([]);
    volSeries.setData([]);

    // ---- Load next 10-min chunk when scrolling to the left edge ----
    const loadMoreCandles = () => {
      if (isFetchingRef.current) return;
      const all    = allCandlesRef.current;
      const loaded = loadedCountRef.current;
      if (loaded >= all.length) return; // Full history already shown

      isFetchingRef.current = true;
      setIsLoadingMore(true);

      const toTime       = (c: any) => Math.floor(new Date(c.bucket_time).getTime() / 1000) as any;
      const oldestIdx    = all.length - loaded;
      const newOldestIdx = Math.max(0, oldestIdx - chunkSize);
      const newSlice     = all.slice(newOldestIdx);

      // Snapshot the current visible range so the view doesn't jump after prepend
      const visibleRange = chart.timeScale().getVisibleRange();

      if (chartType === 'candlestick') {
        mainSeries.setData(newSlice.map((c: any) => ({
          time: toTime(c), open: c.open, high: c.high, low: c.low, close: c.close,
        })));
      } else {
        mainSeries.setData(newSlice.map((c: any) => ({
          time: toTime(c), value: c.close,
        })));
      }

      volSeries.setData(newSlice.map((c: any) => ({
        time:  toTime(c),
        value: c.volume,
        color: c.close >= c.open ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)',
      })));

      // Restore the visible time range so the user stays at the same position
      if (visibleRange) {
        chart.timeScale().setVisibleRange(visibleRange);
      }

      loadedCountRef.current = newSlice.length;

      // Release the debounce lock after a short delay
      setTimeout(() => {
        isFetchingRef.current = false;
        setIsLoadingMore(false);
      }, 400);
    };

    // Fire when user scrolls — load more when they reach the left edge (bar index ≤ 3)
    const handleRangeChange = (range: any) => {
      if (!range) return;
      if (range.from <= 3) loadMoreCandles();
    };
    chart.timeScale().subscribeVisibleLogicalRangeChange(handleRangeChange);

    // ---- Click tools ----
    const handleChartClick = (param: any) => {
      if (!param.point || !param.time) return;
      const tool = activeToolRef.current;

      if (tool === 'text') {
        const price = mainSeries.coordinateToPrice(param.point.y);
        if (price == null) return;
        const marker = {
          time: param.time, position: 'aboveBar' as const,
          color: '#f59e0b', shape: 'arrowDown' as const, text: 'Mark',
        };
        const updated = [...markersRef.current, marker].sort((a, b) => a.time - b.time);
        markersRef.current = updated;
        mainSeries.setMarkers(updated);

      } else if (tool === 'priceLine') {
        const price = mainSeries.coordinateToPrice(param.point.y);
        if (price == null) return;
        mainSeries.createPriceLine({
          price, color: '#3b82f6', lineWidth: 1,
          lineStyle: LineStyle.Dashed, axisLabelVisible: true,
          title: `$${price.toFixed(2)}`,
        });
      }
    };
    chart.subscribeClick(handleChartClick);

    const handleResize = () => chart.applyOptions({ width: chartContainerRef.current?.clientWidth });
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.unsubscribeClick(handleChartClick);
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(handleRangeChange);
      chart.remove();
    };
  // showGrid excluded — handled by its own effect
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [darkMode, chartType, timeframe, symbol]);

  // ---- Grid toggle without chart rebuild ----
  useEffect(() => {
    if (!chartRef.current) return;
    const color = showGrid ? (darkMode ? '#1E1E1E' : '#e0e0e0') : 'transparent';
    chartRef.current.applyOptions({
      grid: {
        vertLines: { color, style: LineStyle.Solid },
        horzLines: { color, style: LineStyle.Solid },
      },
    });
  }, [showGrid, darkMode]);

  const cursorStyle = activeTool === 'cursor' ? 'default' : 'crosshair';

  return (
    <div className="flex w-full h-full bg-panel font-sans">
      {/* Toolbar */}
      <div className="w-12 shrink-0 border-r border-main flex flex-col items-center py-2 gap-3 bg-panel transition-colors">
        <button
          onClick={() => setActiveTool('cursor')}
          className={`p-2 rounded-md transition-all border ${activeTool === 'cursor' ? 'bg-main text-main border-white/20' : 'text-muted hover:text-main hover:bg-main/50 border-transparent'}`}
          title="Cursor"
        ><Crosshair size={18} /></button>

        <button
          onClick={() => setActiveTool('text')}
          className={`p-2 rounded-md transition-all border ${activeTool === 'text' ? 'bg-main text-main border-white/20' : 'text-muted hover:text-main hover:bg-main/50 border-transparent'}`}
          title="Add Marker — click chart"
        ><Type size={18} /></button>

        <button
          onClick={() => setActiveTool('priceLine')}
          className={`p-2 rounded-md transition-all border ${activeTool === 'priceLine' ? 'bg-main text-main border-white/20' : 'text-muted hover:text-main hover:bg-main/50 border-transparent'}`}
          title="Price Line — click chart"
        ><Minus size={18} /></button>

        <button
          onClick={() => setShowGrid(g => !g)}
          className={`p-2 rounded-md transition-all border ${showGrid ? 'bg-main text-main border-white/20' : 'text-muted hover:text-main hover:bg-main/50 border-transparent'}`}
          title="Toggle Grid"
        ><Grid size={18} /></button>

        <div className="w-6 border-t border-main/50 my-1" />

        <div className="mt-auto pb-2">
          <button
            onClick={() => setChartType(t => t === 'candlestick' ? 'line' : 'candlestick')}
            className={`p-2 rounded-md transition-all border ${chartType === 'line' ? 'bg-main text-main border-white/20' : 'text-muted hover:text-main hover:bg-main/50 border-transparent'}`}
            title="Toggle Chart Type"
          ><BarChart2 size={18} /></button>
        </div>
      </div>

      {/* Chart + loading indicator */}
      <div className="relative flex-1 min-w-0 h-full">
        <div ref={chartContainerRef} style={{ cursor: cursorStyle }} className="w-full h-full" />
        {isLoadingMore && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-panel/90 border border-main text-muted text-xs px-3 py-1 rounded-full pointer-events-none select-none">
            Loading older candles…
          </div>
        )}
      </div>
    </div>
  );
}
