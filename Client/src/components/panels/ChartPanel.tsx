import { createChart, IChartApi, ISeriesApi, CrosshairMode, LineStyle } from 'lightweight-charts';
import { useEffect, useRef, useState } from 'react';
import { Crosshair, Type, Minus, Settings, BarChart2, Grid } from 'lucide-react';

interface ChartPanelProps {
  darkMode: boolean;
  timeframe?: string;
}

export function ChartPanel({ darkMode, timeframe = '1m' }: ChartPanelProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);

  const [activeTool, setActiveTool] = useState<'cursor' | 'text' | 'priceLine'>('cursor');
  const [chartType, setChartType] = useState<'candlestick' | 'line'>('candlestick');
  const [showGrid, setShowGrid] = useState(true);
  const activeToolRef = useRef(activeTool);
  const markersRef = useRef<any[]>([]);

  useEffect(() => {
    activeToolRef.current = activeTool;
  }, [activeTool]);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Reset markers on chart recreate
    markersRef.current = [];

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: 'transparent' },
        textColor: darkMode ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)',
        fontFamily: 'var(--font-mono, monospace)',
      },
      grid: {
        vertLines: { 
          color: showGrid ? (darkMode ? '#1E1E1E' : '#e0e0e0') : 'transparent',
          style: LineStyle.Solid,
        },
        horzLines: { 
          color: showGrid ? (darkMode ? '#1E1E1E' : '#e0e0e0') : 'transparent',
          style: LineStyle.Solid,
        },
      },
      timeScale: {
        borderColor: darkMode ? '#1E1E1E' : '#e0e0e0',
        timeVisible: true,
        secondsVisible: false,
        uniformDistribution: true,
      },
      rightPriceScale: {
        borderColor: darkMode ? '#1E1E1E' : '#e0e0e0',
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          width: 1,
          color: darkMode ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.3)',
          style: LineStyle.Dotted,
          labelBackgroundColor: darkMode ? '#1E1E1E' : '#e0e0e0',
        },
        horzLine: {
          width: 1,
          color: darkMode ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.3)',
          style: LineStyle.Dotted,
          labelBackgroundColor: darkMode ? '#1E1E1E' : '#e0e0e0',
        },
      },
      autoSize: true,
    });

    // Hide TradingView watermark
    const watermark = chartContainerRef.current?.querySelector('a[href*="tradingview"]') as HTMLElement;
    if (watermark) watermark.style.display = 'none';

    chartRef.current = chart;

    let mainSeries;
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
    
    seriesRef.current = mainSeries as any;

    const volumeSeries = chart.addHistogramSeries({
      color: '#26a69a',
      priceFormat: { type: 'volume' },
      priceScaleId: '', 
    });
    volumeSeriesRef.current = volumeSeries;

    chart.priceScale('').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    // Use timeframe config for data generation
    const tfConfig: Record<string, { interval: number; count: number; barSpacing: number }> = {
      '1s': { interval: 1, count: 300, barSpacing: 6 },
      '5s': { interval: 5, count: 240, barSpacing: 8 },
      '1m': { interval: 60, count: 240, barSpacing: 12 },
      '5m': { interval: 300, count: 200, barSpacing: 12 },
      '1h': { interval: 3600, count: 168, barSpacing: 14 },
      '1D': { interval: 86400, count: 90, barSpacing: 16 },
    };
    const currentTf = tfConfig[timeframe] || tfConfig['1m'];
    const data = [];
    const volumeData = [];
    const now = Math.floor(Date.now() / 1000);
    let time = now - currentTf.count * currentTf.interval;
    let price = 64230.50;
    
    for (let i = 0; i < currentTf.count; i++) {
      const open = price + (Math.random() - 0.5) * 50;
      const close = open + (Math.random() - 0.5) * 100;
      const high = Math.max(open, close) + Math.random() * 25;
      const low = Math.min(open, close) - Math.random() * 25;
      const vol = Math.floor(Math.random() * 1000) + 100;
      const isUp = close > open;
      
      if (chartType === 'candlestick') {
         data.push({ time: time as any, open, high, low, close });
      } else {
         data.push({ time: time as any, value: close });
      }

      volumeData.push({ 
        time: time as any, 
        value: vol, 
        color: isUp ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)' 
      });
      time += currentTf.interval;
      price = close;
    }

    mainSeries.setData(data as any);
    volumeSeries.setData(volumeData);

    chart.timeScale().applyOptions({ barSpacing: currentTf.barSpacing, minBarSpacing: 5 });
    chart.timeScale().fitContent();

    // Click Subscription for Drawing Tools
    chart.subscribeClick((param) => {
      const tool = activeToolRef.current;
      if (tool === 'cursor' || !param.point || !param.time || !mainSeries) return;

      const yPrice = mainSeries.coordinateToPrice(param.point.y);
      if (yPrice === null) return;

      if (tool === 'text') {
        const text = window.prompt('Enter marker text (e.g., BUY, SELL, Resistance):');
        if (text) {
           markersRef.current.push({
             time: param.time,
             position: 'aboveBar',
             color: darkMode ? '#ffffff' : '#111111',
             shape: 'arrowDown',
             text: text,
           });
           markersRef.current.sort((a, b) => (a.time as number) - (b.time as number));
           mainSeries.setMarkers(markersRef.current);
        }
        setActiveTool('cursor'); // Auto-revert
      } else if (tool === 'priceLine') {
        mainSeries.createPriceLine({
          price: yPrice,
          color: darkMode ? '#ffffff' : '#111111',
          lineWidth: 2,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: true,
          title: 'Level',
        });
        setActiveTool('cursor'); // Auto-revert
      }
    });

    const handleResize = () => {
        chart.applyOptions({ width: chartContainerRef.current?.clientWidth });
    }
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [darkMode, chartType, timeframe, showGrid]);

  return (
    <div className="flex w-full h-full bg-panel font-sans">
      {/* Vertical Chart Toolbar */}
      <div className="w-12 shrink-0 border-r border-main flex flex-col items-center py-2 gap-3 bg-panel transition-colors">
        <button 
          onClick={() => setActiveTool('cursor')}
          className={`p-2 rounded-md transition-all border ${activeTool === 'cursor' ? 'bg-main text-main border-white/20' : 'text-muted hover:text-main hover:bg-main/50 border-transparent'}`}
          title="Cursor"
        >
          <Crosshair size={18} />
        </button>
        <button 
          onClick={() => setActiveTool('text')}
          className={`p-2 rounded-md transition-all border ${activeTool === 'text' ? 'bg-main text-main border-white/20' : 'text-muted hover:text-main hover:bg-main/50 border-transparent'}`}
          title="Add Text Marker"
        >
          <Type size={18} />
        </button>
        <button 
          onClick={() => setActiveTool('priceLine')}
          className={`p-2 rounded-md transition-all border ${activeTool === 'priceLine' ? 'bg-main text-main border-white/20' : 'text-muted hover:text-main hover:bg-main/50 border-transparent'}`}
          title="Horizontal Price Line"
        >
          <Minus size={18} />
        </button>
        
        <button 
          onClick={() => setShowGrid(!showGrid)}
          className={`p-2 rounded-md transition-all border ${showGrid ? 'bg-main text-main border-white/20' : 'text-muted hover:text-main hover:bg-main/50 border-transparent'}`}
          title="Toggle Grid"
        >
          <Grid size={18} />
        </button>
        
        <div className="w-6 border-t border-main/50 my-1" />
        
        <div className="mt-auto flex flex-col gap-2">
          {/* Chart Type Toggle */}
          <button 
            onClick={() => setChartType(t => t === 'candlestick' ? 'line' : 'candlestick')}
            className={`p-2 rounded-md transition-all border ${chartType === 'line' ? 'bg-main text-main border-white/20' : 'text-muted hover:text-main hover:bg-main/50 border-transparent'}`} title="Toggle Chart Type (Candles/Line)"
          >
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
