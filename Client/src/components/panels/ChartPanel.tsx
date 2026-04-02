import { createChart, IChartApi, CrosshairMode, LineStyle } from 'lightweight-charts';
import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Crosshair, Grid, BarChart2,
  TrendingUp, GitBranch,
  ArrowUpCircle, ArrowDownCircle,
  Trash2,
} from 'lucide-react';
import { useTradeWebSocket } from '../../hooks/useTrade';
import { DrawingManager, DrawingPoint } from './chart/drawingManager';
import { OHLCOverlay } from './chart/OHLCOverlay';

// ─── Types ────────────────────────────────────────────────────────────────

type ToolType =
  | 'cursor'
  | 'trendLine'
  | 'channel'
  | 'longPosition'
  | 'shortPosition'
  | 'delete';

interface ChartPanelProps {
  darkMode: boolean;
  timeframe?: string;
  symbol: string;
}

// ─── Component ────────────────────────────────────────────────────────────

export function ChartPanel({ darkMode, timeframe = '1s', symbol }: ChartPanelProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef          = useRef<IChartApi | null>(null);
  const seriesRef         = useRef<any>(null);
  const volumeSeriesRef   = useRef<any>(null);

  const [activeTool, setActiveTool] = useState<ToolType>('cursor');
  const [chartType,  setChartType]  = useState<'candlestick' | 'line'>('candlestick');
  const [showGrid,   setShowGrid]   = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Refs for event handler access (avoid stale closures)
  const activeToolRef    = useRef<ToolType>(activeTool);
  const pendingPointsRef = useRef<DrawingPoint[]>([]);
  const drawingMgrRef    = useRef<DrawingManager>(new DrawingManager());

  useEffect(() => { activeToolRef.current = activeTool; }, [activeTool]);

  const allCandlesRef  = useRef<any[]>([]);
  const loadedCountRef = useRef(0);
  const isFetchingRef  = useRef(false);

  // ─── Safe tool switch ──────────────────────────────────────────────

  const switchTool = useCallback((tool: ToolType) => {
    // Clear any pending drawing points when switching tools
    pendingPointsRef.current = [];
    setActiveTool(tool);
  }, []);

  // ─── Escape key handler (cancel pending drawing) ──────────────────

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        pendingPointsRef.current = [];
        setActiveTool('cursor');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // ─── Live data handler ────────────────────────────────────────────

  const handleLiveTick = useCallback((liveData: any, isHistorical: boolean) => {
    if (!seriesRef.current || !liveData) return;

    const chunkSize = timeframe === '5s' ? 120 : 600;

    try {
      if (isHistorical && Array.isArray(liveData)) {
        allCandlesRef.current = liveData;

        const toTime = (c: any) => Math.floor(new Date(c.bucket_time).getTime() / 1000) as any;
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

      // Live tick
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

  // ─── Create / recreate chart ──────────────────────────────────────

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Reset state
    allCandlesRef.current  = [];
    loadedCountRef.current = 0;
    isFetchingRef.current  = false;
    pendingPointsRef.current = [];

    // Destroy existing drawings from previous chart instance
    drawingMgrRef.current.destroyAll();

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
    drawingMgrRef.current.setChart(chart);

    // Main series
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

    // Volume series
    const volSeries = chart.addHistogramSeries({
      color: '#26a69a', priceFormat: { type: 'volume' }, priceScaleId: '',
    });
    volumeSeriesRef.current = volSeries;
    chart.priceScale('').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });

    mainSeries.setData([]);
    volSeries.setData([]);

    // ─── Lazy-load on scroll ────────────────────────────────────────
    const loadMoreCandles = () => {
      if (isFetchingRef.current) return;
      const all    = allCandlesRef.current;
      const loaded = loadedCountRef.current;
      if (loaded >= all.length) return;

      isFetchingRef.current = true;
      setIsLoadingMore(true);

      const toTime       = (c: any) => Math.floor(new Date(c.bucket_time).getTime() / 1000) as any;
      const oldestIdx    = all.length - loaded;
      const newOldestIdx = Math.max(0, oldestIdx - chunkSize);
      const newSlice     = all.slice(newOldestIdx);

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

      if (visibleRange) {
        chart.timeScale().setVisibleRange(visibleRange);
      }

      loadedCountRef.current = newSlice.length;

      setTimeout(() => {
        isFetchingRef.current = false;
        setIsLoadingMore(false);
      }, 400);
    };

    const handleRangeChange = (range: any) => {
      if (!range) return;
      if (range.from <= 3) loadMoreCandles();
    };
    chart.timeScale().subscribeVisibleLogicalRangeChange(handleRangeChange);

    // ─── Click handler (drawing tools) ──────────────────────────────

    const handleChartClick = (param: any) => {
      try {
        // Validate event data
        if (!param || !param.point || param.time == null) return;

        const price = mainSeries.coordinateToPrice(param.point.y);
        if (price == null || !isFinite(price)) return;

        const time = typeof param.time === 'number'
          ? param.time
          : Math.floor(new Date(param.time).getTime() / 1000);

        if (!isFinite(time)) return;

        const clickPoint: DrawingPoint = { time, price };
        const tool = activeToolRef.current;
        const mgr = drawingMgrRef.current;

        switch (tool) {
          case 'cursor':
            // Default — no drawing action
            break;

          case 'trendLine': {
            pendingPointsRef.current.push(clickPoint);
            if (pendingPointsRef.current.length >= 2) {
              const [p1, p2] = pendingPointsRef.current;
              mgr.addTrendLine(p1, p2);
              pendingPointsRef.current = [];
            }
            break;
          }

          case 'channel': {
            pendingPointsRef.current.push(clickPoint);
            if (pendingPointsRef.current.length >= 3) {
              const [p1, p2, p3] = pendingPointsRef.current;
              mgr.addChannel(p1, p2, p3);
              pendingPointsRef.current = [];
            }
            break;
          }

          case 'longPosition': {
            pendingPointsRef.current.push(clickPoint);
            if (pendingPointsRef.current.length >= 2) {
              const [entry, exit] = pendingPointsRef.current;
              mgr.addPosition(entry, exit, 'longPosition');
              pendingPointsRef.current = [];
            }
            break;
          }

          case 'shortPosition': {
            pendingPointsRef.current.push(clickPoint);
            if (pendingPointsRef.current.length >= 2) {
              const [entry, exit] = pendingPointsRef.current;
              mgr.addPosition(entry, exit, 'shortPosition');
              pendingPointsRef.current = [];
            }
            break;
          }

          case 'delete': {
            mgr.deleteNearest(clickPoint);
            break;
          }

          default:
            break;
        }
      } catch (err) {
        console.error('Chart click handler error:', err);
      }
    };
    chart.subscribeClick(handleChartClick);

    // ─── Resize ─────────────────────────────────────────────────────

    const handleResize = () => chart.applyOptions({ width: chartContainerRef.current?.clientWidth });
    window.addEventListener('resize', handleResize);

    // ─── Cleanup ────────────────────────────────────────────────────

    return () => {
      window.removeEventListener('resize', handleResize);
      try { chart.unsubscribeClick(handleChartClick); } catch { /* noop */ }
      try { chart.timeScale().unsubscribeVisibleLogicalRangeChange(handleRangeChange); } catch { /* noop */ }
      drawingMgrRef.current.destroyAll();
      try { chart.remove(); } catch { /* noop */ }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [darkMode, chartType, timeframe, symbol]);

  // ─── Grid toggle without chart rebuild ────────────────────────────

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

  // ─── Derived state ────────────────────────────────────────────────

  const cursorStyle = activeTool === 'cursor' ? 'default' : 'crosshair';

  const pendingClickCount =
    activeTool === 'trendLine' || activeTool === 'longPosition' || activeTool === 'shortPosition'
      ? 2
      : activeTool === 'channel'
        ? 3
        : 0;

  // ─── Toolbar button helper ────────────────────────────────────────

  const ToolBtn = ({ tool, title, icon: Icon }: { tool: ToolType; title: string; icon: any }) => (
    <button
      onClick={() => switchTool(tool)}
      className={`p-2 rounded-md transition-all border ${
        activeTool === tool
          ? 'bg-main text-main border-white/20'
          : 'text-muted hover:text-main hover:bg-main/50 border-transparent'
      }`}
      title={title}
    >
      <Icon size={18} />
    </button>
  );

  // ─── Render ───────────────────────────────────────────────────────

  return (
    <div className="flex w-full h-full bg-panel font-sans">
      {/* Left Toolbar */}
      <div className="w-12 shrink-0 border-r border-main flex flex-col items-center py-2 gap-1.5 bg-panel transition-colors">
        <ToolBtn tool="cursor"        title="Cursor"           icon={Crosshair} />

        <div className="w-6 border-t border-main/50 my-0.5" />

        <ToolBtn tool="trendLine"     title="Trend Line (2 clicks)"     icon={TrendingUp} />
        <ToolBtn tool="channel"       title="Parallel Channel (3 clicks)" icon={GitBranch} />

        <div className="w-6 border-t border-main/50 my-0.5" />

        <ToolBtn tool="longPosition"  title="Long Position (2 clicks)"  icon={ArrowUpCircle} />
        <ToolBtn tool="shortPosition" title="Short Position (2 clicks)" icon={ArrowDownCircle} />

        <div className="w-6 border-t border-main/50 my-0.5" />

        <ToolBtn tool="delete"        title="Delete Drawing (click nearest)" icon={Trash2} />

        <div className="w-6 border-t border-main/50 my-0.5" />

        <button
          onClick={() => setShowGrid(g => !g)}
          className={`p-2 rounded-md transition-all border ${showGrid ? 'bg-main text-main border-white/20' : 'text-muted hover:text-main hover:bg-main/50 border-transparent'}`}
          title="Toggle Grid"
        >
          <Grid size={18} />
        </button>

        <div className="mt-auto pb-2">
          <button
            onClick={() => setChartType(t => t === 'candlestick' ? 'line' : 'candlestick')}
            className={`p-2 rounded-md transition-all border ${chartType === 'line' ? 'bg-main text-main border-white/20' : 'text-muted hover:text-main hover:bg-main/50 border-transparent'}`}
            title="Toggle Chart Type"
          >
            <BarChart2 size={18} />
          </button>
        </div>
      </div>

      {/* Chart area */}
      <div className="relative flex-1 min-w-0 h-full">
        <div ref={chartContainerRef} style={{ cursor: cursorStyle }} className="w-full h-full" />

        {/* OHLC overlay */}
        {chartType === 'candlestick' && (
          <OHLCOverlay chartRef={chartRef} seriesRef={seriesRef} darkMode={darkMode} />
        )}

        {/* Pending click indicator */}
        {pendingClickCount > 0 && pendingPointsRef.current.length > 0 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-panel/90 border border-main text-muted text-xs px-3 py-1 rounded-full pointer-events-none select-none">
            Click {pendingPointsRef.current.length}/{pendingClickCount} — press Esc to cancel
          </div>
        )}

        {/* Loading indicator */}
        {isLoadingMore && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-panel/90 border border-main text-muted text-xs px-3 py-1 rounded-full pointer-events-none select-none">
            Loading older candles…
          </div>
        )}
      </div>
    </div>
  );
}
