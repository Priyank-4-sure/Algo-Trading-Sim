import { createChart, IChartApi, ISeriesApi, CrosshairMode, LineStyle } from 'lightweight-charts';
import { useEffect, useRef, useState } from 'react';
import { Crosshair, Type, Minus, Settings, BarChart2, Grid } from 'lucide-react';
import { useWebSocket } from '../../contexts/WebSocketContext';

interface ChartPanelProps {
  darkMode: boolean;
  timeframe?: string;
}

// A single price tick: wall-clock seconds + mid-price
interface PriceTick {
  time: number; // Unix seconds
  price: number;
}

// -------------------------------------------------------
// Aggregate a flat list of price ticks into OHLC candles
// bucketed by `intervalSeconds`
// -------------------------------------------------------
function aggregateCandles(
  ticks: PriceTick[],
  intervalSeconds: number
): { time: number; open: number; high: number; low: number; close: number }[] {
  const buckets = new Map<number, { open: number; high: number; low: number; close: number }>();

  for (const tick of ticks) {
    const bucket = Math.floor(tick.time / intervalSeconds) * intervalSeconds;
    const existing = buckets.get(bucket);
    if (!existing) {
      buckets.set(bucket, { open: tick.price, high: tick.price, low: tick.price, close: tick.price });
    } else {
      existing.high = Math.max(existing.high, tick.price);
      existing.low = Math.min(existing.low, tick.price);
      existing.close = tick.price;
    }
  }

  return Array.from(buckets.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([time, ohlc]) => ({ time, ...ohlc }));
}

// -------------------------------------------------------
// Build synthetic historical ticks anchored to real time
// (deterministic so they're the same across timeframe switches)
// -------------------------------------------------------
function buildHistoryTicks(ticksPerCandle: number, count: number, intervalSeconds: number, endTime: number): PriceTick[] {
  const ticks: PriceTick[] = [];
  const totalTicks = count * ticksPerCandle;
  const tickInterval = intervalSeconds / ticksPerCandle;

  let price = 64230.50;
  // Use a simple LCG for deterministic randomness
  let seed = 42;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff;
    return (seed >>> 0) / 0xffffffff - 0.5;
  };

  const startTime = endTime - totalTicks * tickInterval;
  for (let i = 0; i < totalTicks; i++) {
    price += rand() * 25 + rand() * 5; // Small random walk
    price = Math.max(price, 1000); // floor
    ticks.push({
      time: Math.floor(startTime + i * tickInterval),
      price,
    });
  }
  return ticks;
}

const TF_CONFIG: Record<string, { interval: number; histCount: number; ticksPerCandle: number }> = {
  '1s':  { interval: 1,     histCount: 200, ticksPerCandle: 1  },
  '5s':  { interval: 5,     histCount: 200, ticksPerCandle: 2  },
  '1m':  { interval: 60,    histCount: 200, ticksPerCandle: 4  },
  '5m':  { interval: 300,   histCount: 200, ticksPerCandle: 4  },
  '1h':  { interval: 3600,  histCount: 200, ticksPerCandle: 4  },
  '1D':  { interval: 86400, histCount: 200, ticksPerCandle: 4  },
};

export function ChartPanel({ darkMode, timeframe = '1m' }: ChartPanelProps) {
  const { lastMessage } = useWebSocket();
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);

  // Persistent tick history — survives timeframe switches
  const liveTicks = useRef<PriceTick[]>([]);
  // History ticks generated once on first mount (deterministic)
  const historyTicks = useRef<PriceTick[]>([]);
  const historyBuiltUntil = useRef<number>(0);

  const [activeTool, setActiveTool] = useState<'cursor' | 'text' | 'priceLine'>('cursor');
  const [chartType, setChartType] = useState<'candlestick' | 'line'>('candlestick');
  const [showGrid, setShowGrid] = useState(true);
  const activeToolRef = useRef(activeTool);
  const markersRef = useRef<any[]>([]);

  useEffect(() => { activeToolRef.current = activeTool; }, [activeTool]);

  // ---- Chart creation (reset when darkMode / chartType / showGrid change) ----
  useEffect(() => {
    if (!chartContainerRef.current) return;
    markersRef.current = [];

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: 'transparent' },
        textColor: darkMode ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)',
        fontFamily: 'var(--font-mono, monospace)',
      },
      grid: {
        vertLines: { color: showGrid ? (darkMode ? '#1E1E1E' : '#e0e0e0') : 'transparent', style: LineStyle.Solid },
        horzLines: { color: showGrid ? (darkMode ? '#1E1E1E' : '#e0e0e0') : 'transparent', style: LineStyle.Solid },
      },
      timeScale: {
        borderColor: darkMode ? '#1E1E1E' : '#e0e0e0',
        timeVisible: true,
        secondsVisible: timeframe === '1s' || timeframe === '5s',
        // uniformDistribution: true, // Removed to ensure real-time spacing
        shiftVisibleRangeOnNewBar: true,
        rightOffset: 5,
      },
      localization: {
        locale: 'en-US',
        timeFormatter: (timestamp: number) => {
          return new Date(timestamp * 1000).toLocaleTimeString();
        },
      },
      rightPriceScale: { borderColor: darkMode ? '#1E1E1E' : '#e0e0e0' },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { width: 1, color: darkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.3)', style: LineStyle.Dotted, labelBackgroundColor: darkMode ? '#1E1E1E' : '#e0e0e0' },
        horzLine: { width: 1, color: darkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.3)', style: LineStyle.Dotted, labelBackgroundColor: darkMode ? '#1E1E1E' : '#e0e0e0' },
      },
      autoSize: true,
    });

    chartRef.current = chart;

    let mainSeries: any;
    if (chartType === 'candlestick') {
      mainSeries = chart.addCandlestickSeries({
        upColor: darkMode ? '#22c55e' : '#16a34a',
        downColor: darkMode ? '#ef4444' : '#dc2626',
        borderVisible: false,
        wickUpColor: darkMode ? '#22c55e' : '#16a34a',
        wickDownColor: darkMode ? '#ef4444' : '#dc2626',
      });
    } else {
      mainSeries = chart.addLineSeries({
        color: darkMode ? '#ffffff' : '#111111',
        lineWidth: 2,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 4,
      });
    }
    seriesRef.current = mainSeries;

    const volumeSeries = chart.addHistogramSeries({
      color: '#26a69a',
      priceFormat: { type: 'volume' },
      priceScaleId: '',
    });
    volumeSeriesRef.current = volumeSeries;
    chart.priceScale('').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });

    const tf = TF_CONFIG[timeframe] || TF_CONFIG['1m'];
    const nowSeconds = Math.floor(Date.now() / 1000);

    // Build history ticks once (they are deterministic and shared across all timeframes)
    if (historyBuiltUntil.current === 0) {
      historyTicks.current = buildHistoryTicks(tf.ticksPerCandle, tf.histCount, tf.interval, nowSeconds);
      historyBuiltUntil.current = nowSeconds;
    }

    // Merge history + live ticks, then aggregate into the current timeframe
    const allTicks = [...historyTicks.current, ...liveTicks.current];
    const candles = aggregateCandles(allTicks, tf.interval);

    if (chartType === 'candlestick') {
      mainSeries.setData(candles);
    } else {
      mainSeries.setData(candles.map(c => ({ time: c.time as any, value: c.close })));
    }
    volumeSeries.setData(candles.map(c => ({
      time: c.time as any,
      value: Math.abs(c.close - c.open) * 10 + 50,
      color: c.close >= c.open ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)',
    })));

    chart.timeScale().applyOptions({ barSpacing: 6, minBarSpacing: 2 });
    // chart.timeScale().fitContent(); // Disabled to prevent huge/wide bars on large timeframes


    // Drawing tools
    chart.subscribeClick((param) => {
      const tool = activeToolRef.current;
      if (tool === 'cursor' || !param.point || !param.time || !mainSeries) return;
      const yPrice = mainSeries.coordinateToPrice(param.point.y);
      if (yPrice === null) return;
      if (tool === 'text') {
        const text = window.prompt('Enter marker text:');
        if (text) {
          markersRef.current.push({ time: param.time, position: 'aboveBar', color: darkMode ? '#fff' : '#111', shape: 'arrowDown', text });
          markersRef.current.sort((a, b) => (a.time as number) - (b.time as number));
          mainSeries.setMarkers(markersRef.current);
        }
        setActiveTool('cursor');
      } else if (tool === 'priceLine') {
        mainSeries.createPriceLine({ price: yPrice, color: darkMode ? '#fff' : '#111', lineWidth: 2, lineStyle: LineStyle.Solid, axisLabelVisible: true, title: 'Level' });
        setActiveTool('cursor');
      }
    });

    const handleResize = () => chart.applyOptions({ width: chartContainerRef.current?.clientWidth });
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [darkMode, chartType, timeframe, showGrid]);

  // ---- Real-time update: consume lob_update, compute mid-price, update live candle ----
  useEffect(() => {
    if (!lastMessage || lastMessage.action !== 'lob_update') return;
    if (!seriesRef.current || !volumeSeriesRef.current) return;

    const payload = lastMessage.payload;
    const asks: { price: number; amount: number }[] = payload?.asks || [];
    const bids: { price: number; amount: number }[] = payload?.bids || [];
    if (asks.length === 0 || bids.length === 0) return;

    const midPrice = (asks[0].price + bids[0].price) / 2;
    const totalVolume = asks.reduce((s, a) => s + a.amount, 0) + bids.reduce((s, b) => s + b.amount, 0);
    const nowSeconds = Math.floor(Date.now() / 1000);

    // Store tick in live history
    liveTicks.current.push({ time: nowSeconds, price: midPrice });
    // Keep only last 24h of ticks to avoid memory growth
    if (liveTicks.current.length > 86400) liveTicks.current = liveTicks.current.slice(-86400);

    const tf = TF_CONFIG[timeframe] || TF_CONFIG['1m'];
    const bucketTime = Math.floor(nowSeconds / tf.interval) * tf.interval;

    try {
      // Update candle series
      const allBucketTicks = liveTicks.current.filter(t => Math.floor(t.time / tf.interval) * tf.interval === bucketTime);
      if (allBucketTicks.length === 0) return;

      const open = allBucketTicks[0].price;
      const close = midPrice;
      const high = Math.max(...allBucketTicks.map(t => t.price));
      const low = Math.min(...allBucketTicks.map(t => t.price));

      if (chartType === 'candlestick') {
        (seriesRef.current as any).update({ time: bucketTime as any, open, high, low, close });
      } else {
        (seriesRef.current as any).update({ time: bucketTime as any, value: close });
      }

      (volumeSeriesRef.current as any).update({
        time: bucketTime as any,
        value: totalVolume,
        color: close >= open ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)',
      });
    } catch (e) {
      console.error('Chart update error:', e);
    }
  }, [lastMessage, chartType, timeframe]);

  return (
    <div className="flex w-full h-full bg-panel font-sans">
      {/* Vertical Chart Toolbar */}
      <div className="w-12 shrink-0 border-r border-main flex flex-col items-center py-2 gap-3 bg-panel transition-colors">
        <button onClick={() => setActiveTool('cursor')} className={`p-2 rounded-md transition-all border ${activeTool === 'cursor' ? 'bg-main text-main border-white/20' : 'text-muted hover:text-main hover:bg-main/50 border-transparent'}`} title="Cursor">
          <Crosshair size={18} />
        </button>
        <button onClick={() => setActiveTool('text')} className={`p-2 rounded-md transition-all border ${activeTool === 'text' ? 'bg-main text-main border-white/20' : 'text-muted hover:text-main hover:bg-main/50 border-transparent'}`} title="Add Text Marker">
          <Type size={18} />
        </button>
        <button onClick={() => setActiveTool('priceLine')} className={`p-2 rounded-md transition-all border ${activeTool === 'priceLine' ? 'bg-main text-main border-white/20' : 'text-muted hover:text-main hover:bg-main/50 border-transparent'}`} title="Horizontal Price Line">
          <Minus size={18} />
        </button>
        <button onClick={() => setShowGrid(!showGrid)} className={`p-2 rounded-md transition-all border ${showGrid ? 'bg-main text-main border-white/20' : 'text-muted hover:text-main hover:bg-main/50 border-transparent'}`} title="Toggle Grid">
          <Grid size={18} />
        </button>
        <div className="w-6 border-t border-main/50 my-1" />
        <div className="mt-auto flex flex-col gap-2">
          <button onClick={() => setChartType(t => t === 'candlestick' ? 'line' : 'candlestick')} className={`p-2 rounded-md transition-all border ${chartType === 'line' ? 'bg-main text-main border-white/20' : 'text-muted hover:text-main hover:bg-main/50 border-transparent'}`} title="Toggle Chart Type (Candles/Line)">
            <BarChart2 size={18} />
          </button>
          <button className="p-2 rounded-md transition-all border text-muted hover:text-main hover:bg-main/50 border-transparent" title="Settings">
            <Settings size={18} />
          </button>
        </div>
      </div>

      {/* Main Chart Container */}
      <div ref={chartContainerRef} className="flex-1 min-w-0 h-full" />
    </div>
  );
}
