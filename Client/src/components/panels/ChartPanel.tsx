import { createChart, IChartApi, CrosshairMode, LineStyle } from 'lightweight-charts';
import { useEffect, useRef, useState, useCallback } from 'react';
import { Crosshair, Type, Minus, Settings, BarChart2, Grid } from 'lucide-react';
import { useTradeWebSocket } from '../../hooks/useTrade'; // Verify this path!

interface ChartPanelProps {
  darkMode: boolean;
  timeframe?: string;
  symbol: string;
}

export function ChartPanel({ darkMode, timeframe = '1s', symbol }: ChartPanelProps) {
  
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  
  const seriesRef = useRef<any>(null); 
  const volumeSeriesRef = useRef<any>(null);

  const [activeTool, setActiveTool] = useState<'cursor' | 'text' | 'priceLine'>('cursor');
  const [chartType, setChartType] = useState<'candlestick' | 'line'>('candlestick');
  const [showGrid, setShowGrid] = useState(true);
  const activeToolRef = useRef(activeTool);
  const markersRef = useRef<any[]>([]);

  useEffect(() => {
    activeToolRef.current = activeTool;
  }, [activeTool]);

  // ==========================================================
  // THE DIRECT WIRE: High-Frequency Data Catcher
  // ==========================================================
  const handleLiveTick = useCallback((liveData: any) => {
    
    // 🚨 HERE IS YOUR CONSOLE LOG 🚨
    console.log("📈 INCOMING WS DATA:", liveData);

    // If the chart isn't drawn yet, or data is empty, ignore the tick
    if (!seriesRef.current || !liveData) return;

    try {
      // FIX 1: Convert Go's ISO time string to a Unix Timestamp (Seconds)
      // Example: "2026-03-31T16:35:22+05:30" becomes 1774955722
      const timeInSeconds = Math.floor(new Date(liveData.bucket_time).getTime() / 1000);
      
      const isUp = liveData.close >= liveData.open;

      // FIX 2: Push the perfectly formatted data to the chart
      if (chartType === 'candlestick') {
        seriesRef.current.update({
          time: timeInSeconds as any,
          open: liveData.open,
          high: liveData.high,
          low: liveData.low,
          close: liveData.close,
        });
      } else {
        seriesRef.current.update({
          time: timeInSeconds as any,
          value: liveData.close,
        });
      }

      // Update the volume bars
      if (volumeSeriesRef.current && liveData.volume !== undefined) {
        volumeSeriesRef.current.update({
          time: timeInSeconds as any,
          value: liveData.volume,
          color: isUp ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)'
        });
      }
      
    } catch (error) {
       console.error("Live chart update failed:", error);
    }
  }, [chartType]);
  
  // Connect the websocket
  useTradeWebSocket(symbol, handleLiveTick);

  // ==========================================================
  // Create Chart (Runs ONCE on load)
  // ==========================================================
  useEffect(() => {
    if (!chartContainerRef.current) return;
    markersRef.current = [];

    const chart = createChart(chartContainerRef.current, {
      layout: { background: { color: 'transparent' }, textColor: darkMode ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' },
      grid: {
        vertLines: { color: showGrid ? (darkMode ? '#1E1E1E' : '#e0e0e0') : 'transparent', style: LineStyle.Solid },
        horzLines: { color: showGrid ? (darkMode ? '#1E1E1E' : '#e0e0e0') : 'transparent', style: LineStyle.Solid },
      },
      timeScale: { borderColor: darkMode ? '#1E1E1E' : '#e0e0e0', timeVisible: true, secondsVisible: false },
      rightPriceScale: { borderColor: darkMode ? '#1E1E1E' : '#e0e0e0' },
      crosshair: { mode: CrosshairMode.Normal },
      autoSize: true,
    });

    chartRef.current = chart;

    let mainSeries;
    if (chartType === 'candlestick') {
      mainSeries = chart.addCandlestickSeries({
        upColor: darkMode ? '#22c55e' : '#16a34a', downColor: darkMode ? '#ef4444' : '#dc2626', borderVisible: false,
        wickUpColor: darkMode ? '#22c55e' : '#16a34a', wickDownColor: darkMode ? '#ef4444' : '#dc2626',
      });
    } else {
      mainSeries = chart.addLineSeries({ color: darkMode ? '#ffffff' : '#111111', lineWidth: 2 });
    }
    
    seriesRef.current = mainSeries;
    const volumeSeries = chart.addHistogramSeries({ color: '#26a69a', priceFormat: { type: 'volume' }, priceScaleId: '' });
    volumeSeriesRef.current = volumeSeries;
    chart.priceScale('').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });

    // We initialize the chart with absolutely nothing so it waits for real data.
    mainSeries.setData([]);
    volumeSeries.setData([]);

    const handleResize = () => chart.applyOptions({ width: chartContainerRef.current?.clientWidth });
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [darkMode, chartType, timeframe, showGrid, symbol]);

  return (
    <div className="flex w-full h-full bg-panel font-sans">
      <div className="w-12 shrink-0 border-r border-main flex flex-col items-center py-2 gap-3 bg-panel transition-colors">
        <button onClick={() => setActiveTool('cursor')} className={`p-2 rounded-md transition-all border ${activeTool === 'cursor' ? 'bg-main text-main border-white/20' : 'text-muted hover:text-main hover:bg-main/50 border-transparent'}`} title="Cursor"><Crosshair size={18} /></button>
        <button onClick={() => setActiveTool('text')} className={`p-2 rounded-md transition-all border ${activeTool === 'text' ? 'bg-main text-main border-white/20' : 'text-muted hover:text-main hover:bg-main/50 border-transparent'}`} title="Add Text Marker"><Type size={18} /></button>
        <button onClick={() => setActiveTool('priceLine')} className={`p-2 rounded-md transition-all border ${activeTool === 'priceLine' ? 'bg-main text-main border-white/20' : 'text-muted hover:text-main hover:bg-main/50 border-transparent'}`} title="Horizontal Price Line"><Minus size={18} /></button>
        <button onClick={() => setShowGrid(!showGrid)} className={`p-2 rounded-md transition-all border ${showGrid ? 'bg-main text-main border-white/20' : 'text-muted hover:text-main hover:bg-main/50 border-transparent'}`} title="Toggle Grid"><Grid size={18} /></button>
        <div className="w-6 border-t border-main/50 my-1" />
        <div className="mt-auto flex flex-col gap-2">
          <button onClick={() => setChartType(t => t === 'candlestick' ? 'line' : 'candlestick')} className={`p-2 rounded-md transition-all border ${chartType === 'line' ? 'bg-main text-main border-white/20' : 'text-muted hover:text-main hover:bg-main/50 border-transparent'}`} title="Toggle Chart Type (Candles/Line)"><BarChart2 size={18} /></button>
          <button className="p-2 rounded-md transition-all border text-muted hover:text-main hover:bg-main/50 border-transparent" title="Settings"><Settings size={18} /></button>
        </div>
      </div>
      <div ref={chartContainerRef} className="flex-1 min-w-0 h-full" />
    </div>
  );
}