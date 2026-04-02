/**
 * OHLCOverlay.tsx
 *
 * Displays O, H, L, C values in the top-left corner of the chart area.
 * Uses direct DOM manipulation via refs + requestAnimationFrame to avoid
 * React re-renders on every crosshair move.
 */

import { useEffect, useRef, MutableRefObject } from 'react';
import { IChartApi, ISeriesApi } from 'lightweight-charts';

interface OHLCOverlayProps {
  chartRef: MutableRefObject<IChartApi | null>;
  seriesRef: MutableRefObject<ISeriesApi<'Candlestick'> | null>;
  darkMode: boolean;
}

interface OHLCValues {
  open: number;
  high: number;
  low: number;
  close: number;
  change: number;     // close - open
  changePercent: number;
}

export function OHLCOverlay({ chartRef, seriesRef, darkMode }: OHLCOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const lastValuesRef = useRef<OHLCValues | null>(null);
  const rafIdRef = useRef<number>(0);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const handler = (param: any) => {
      // Cancel any pending frame to avoid stacking
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }

      rafIdRef.current = requestAnimationFrame(() => {
        const container = containerRef.current;
        if (!container) return;

        let values: OHLCValues | null = null;

        try {
          if (param && param.seriesData && seriesRef.current) {
            const data = param.seriesData.get(seriesRef.current);
            if (data) {
              // Candlestick data has open/high/low/close
              const d = data as any;
              if (
                typeof d.open === 'number' &&
                typeof d.high === 'number' &&
                typeof d.low === 'number' &&
                typeof d.close === 'number'
              ) {
                const change = d.close - d.open;
                const changePercent = d.open !== 0 ? (change / d.open) * 100 : 0;
                values = {
                  open: d.open,
                  high: d.high,
                  low: d.low,
                  close: d.close,
                  change,
                  changePercent,
                };
                lastValuesRef.current = values;
              }
            }
          }
        } catch {
          // Silently ignore — keep last known values
        }

        // If no values from this tick, try last known
        if (!values) {
          values = lastValuesRef.current;
        }

        if (!values) {
          container.style.opacity = '0';
          return;
        }

        container.style.opacity = '1';
        const isUp = values.close >= values.open;
        const color = isUp
          ? (darkMode ? '#22c55e' : '#16a34a')
          : (darkMode ? '#ef4444' : '#dc2626');

        container.innerHTML = `
          <span style="color:${darkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'}">O</span>
          <span style="color:${color}">${values.open.toFixed(2)}</span>
          <span style="color:${darkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'}; margin-left:8px">H</span>
          <span style="color:${color}">${values.high.toFixed(2)}</span>
          <span style="color:${darkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'}; margin-left:8px">L</span>
          <span style="color:${color}">${values.low.toFixed(2)}</span>
          <span style="color:${darkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'}; margin-left:8px">C</span>
          <span style="color:${color}">${values.close.toFixed(2)}</span>
          <span style="color:${color}; margin-left:12px; font-size:11px">${values.change >= 0 ? '+' : ''}${values.change.toFixed(2)} (${values.changePercent >= 0 ? '+' : ''}${values.changePercent.toFixed(2)}%)</span>
        `;
      });
    };

    chart.subscribeCrosshairMove(handler);

    return () => {
      try {
        chart.unsubscribeCrosshairMove(handler);
      } catch {
        // Chart might already be disposed
      }
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [chartRef, seriesRef, darkMode]);

  return (
    <div
      ref={containerRef}
      className="ohlc-overlay"
      style={{
        position: 'absolute',
        top: 8,
        left: 8,
        zIndex: 10,
        fontFamily: 'var(--font-mono)',
        fontSize: '12px',
        lineHeight: '18px',
        pointerEvents: 'none',
        userSelect: 'none',
        opacity: 0,
        transition: 'opacity 0.15s ease',
        whiteSpace: 'nowrap',
      }}
    />
  );
}
