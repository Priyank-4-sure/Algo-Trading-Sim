/**
 * drawingManager.ts
 * 
 * Pure-logic drawing manager for TradingView Lightweight Charts.
 * Manages trend lines, parallel channels, long/short position tools,
 * and deletion. Owns all drawing state and series references.
 * 
 * Every public method is wrapped in try-catch for safety.
 */

import { IChartApi, ISeriesApi, LineStyle } from 'lightweight-charts';

// ─── Types ────────────────────────────────────────────────────────────────

export type DrawingType = 'trendLine' | 'channel' | 'longPosition' | 'shortPosition';

export interface DrawingPoint {
  time: number;
  price: number;
}

export interface Drawing {
  id: string;
  type: DrawingType;
  points: DrawingPoint[];
  seriesRefs: ISeriesApi<'Line'>[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────

let _idCounter = 0;

function generateId(): string {
  _idCounter += 1;
  return `drawing_${Date.now()}_${_idCounter}`;
}

function isValidPoint(p: unknown): p is DrawingPoint {
  if (!p || typeof p !== 'object') return false;
  const pt = p as DrawingPoint;
  return (
    typeof pt.time === 'number' &&
    isFinite(pt.time) &&
    typeof pt.price === 'number' &&
    isFinite(pt.price)
  );
}

function isValidPointArray(points: unknown[], requiredCount: number): points is DrawingPoint[] {
  if (!Array.isArray(points) || points.length < requiredCount) return false;
  for (let i = 0; i < requiredCount; i++) {
    if (!isValidPoint(points[i])) return false;
  }
  return true;
}

// ─── Drawing Manager Class ────────────────────────────────────────────────

export class DrawingManager {
  private chart: IChartApi | null = null;
  private drawings: Map<string, Drawing> = new Map();

  /**
   * Bind the manager to a chart instance.
   * Call this every time the chart is recreated.
   */
  setChart(chart: IChartApi | null): void {
    this.chart = chart;
  }

  /**
   * Get all current drawings (for iteration, e.g. delete-nearest).
   */
  getDrawings(): Drawing[] {
    return Array.from(this.drawings.values());
  }

  // ─── Trend Line ─────────────────────────────────────────────────────

  /**
   * Create a trend line between two points.
   * Returns the drawing id, or null on failure.
   */
  addTrendLine(p1: DrawingPoint, p2: DrawingPoint): string | null {
    try {
      if (!this.chart) {
        console.warn('[DrawingManager] No chart bound — cannot add trend line.');
        return null;
      }
      if (!isValidPoint(p1) || !isValidPoint(p2)) {
        console.warn('[DrawingManager] Invalid points for trend line:', p1, p2);
        return null;
      }

      const series = this.chart.addLineSeries({
        color: '#3b82f6',
        lineWidth: 2,
        lineStyle: LineStyle.Solid,
        crosshairMarkerVisible: false,
        lastValueVisible: false,
        priceLineVisible: false,
      });

      // LineSeries data must be sorted by time ascending
      const data = [
        { time: p1.time as any, value: p1.price },
        { time: p2.time as any, value: p2.price },
      ].sort((a, b) => (a.time as number) - (b.time as number));

      series.setData(data);

      const id = generateId();
      this.drawings.set(id, {
        id,
        type: 'trendLine',
        points: [p1, p2],
        seriesRefs: [series],
      });
      return id;
    } catch (err) {
      console.error('[DrawingManager] addTrendLine error:', err);
      return null;
    }
  }

  // ─── Parallel Channel ──────────────────────────────────────────────

  /**
   * Create a parallel channel from 3 points:
   *   p1, p2 → define the first edge
   *   p3     → defines the offset (second edge is parallel, passing through p3)
   */
  addChannel(p1: DrawingPoint, p2: DrawingPoint, p3: DrawingPoint): string | null {
    try {
      if (!this.chart) {
        console.warn('[DrawingManager] No chart bound — cannot add channel.');
        return null;
      }
      if (!isValidPointArray([p1, p2, p3], 3)) {
        console.warn('[DrawingManager] Invalid points for channel:', p1, p2, p3);
        return null;
      }

      // Calculate the price offset for the parallel line
      const priceOffset = p3.price - p1.price;

      const makeSeries = (color: string, style: number) => {
        const s = this.chart!.addLineSeries({
          color,
          lineWidth: 1,
          lineStyle: style,
          crosshairMarkerVisible: false,
          lastValueVisible: false,
          priceLineVisible: false,
        });
        return s;
      };

      // First edge: p1 → p2
      const edge1 = makeSeries('#8b5cf6', LineStyle.Solid);
      const edge1Data = [
        { time: p1.time as any, value: p1.price },
        { time: p2.time as any, value: p2.price },
      ].sort((a, b) => (a.time as number) - (b.time as number));
      edge1.setData(edge1Data);

      // Second edge: parallel to first, offset by priceOffset
      const edge2 = makeSeries('#8b5cf6', LineStyle.Solid);
      const edge2Data = [
        { time: p1.time as any, value: p1.price + priceOffset },
        { time: p2.time as any, value: p2.price + priceOffset },
      ].sort((a, b) => (a.time as number) - (b.time as number));
      edge2.setData(edge2Data);

      // Middle line (dashed): midpoint between edges
      const mid = makeSeries('rgba(139,92,246,0.4)', LineStyle.Dashed);
      const midData = [
        { time: p1.time as any, value: p1.price + priceOffset / 2 },
        { time: p2.time as any, value: p2.price + priceOffset / 2 },
      ].sort((a, b) => (a.time as number) - (b.time as number));
      mid.setData(midData);

      const id = generateId();
      this.drawings.set(id, {
        id,
        type: 'channel',
        points: [p1, p2, p3],
        seriesRefs: [edge1, edge2, mid],
      });
      return id;
    } catch (err) {
      console.error('[DrawingManager] addChannel error:', err);
      return null;
    }
  }

  // ─── Long / Short Position ─────────────────────────────────────────

  /**
   * Add a long or short position tool.
   * Takes entry point (click1) and a second point that defines stop-loss and take-profit.
   *   - Long:  stop < entry < target
   *   - Short: target < entry < stop
   * 
   * @param entryPoint - the entry coordinate (time + price)
   * @param exitPoint  - the SL/TP target coordinate (time + price)
   * @param type       - 'longPosition' or 'shortPosition'
   */
  addPosition(
    entryPoint: DrawingPoint,
    exitPoint: DrawingPoint,
    type: 'longPosition' | 'shortPosition'
  ): string | null {
    try {
      if (!this.chart) {
        console.warn('[DrawingManager] No chart bound — cannot add position.');
        return null;
      }
      if (!isValidPoint(entryPoint) || !isValidPoint(exitPoint)) {
        console.warn('[DrawingManager] Invalid points for position:', entryPoint, exitPoint);
        return null;
      }

      const entry = entryPoint.price;
      const exit = exitPoint.price;
      if (entry === exit) {
        console.warn('[DrawingManager] Entry and exit prices are equal — cannot create position.');
        return null;
      }

      // Determine SL and TP based on type
      let stopLoss: number;
      let takeProfit: number;

      if (type === 'longPosition') {
        // For long: stop is below entry, target is above
        // The distance from entry to exit determines the SL
        // If exit > entry, exit is our TP, mirrored for SL
        // If exit < entry, exit is our SL, mirrored for TP
        const distance = Math.abs(exit - entry);
        if (exit > entry) {
          takeProfit = exit;
          stopLoss = entry - distance;
        } else {
          stopLoss = exit;
          takeProfit = entry + distance;
        }
        // Validate: stop < entry < target
        if (!(stopLoss < entry && entry < takeProfit)) {
          console.warn('[DrawingManager] Long position validation failed:', { stopLoss, entry, takeProfit });
          return null;
        }
      } else {
        // short: target < entry < stop
        const distance = Math.abs(exit - entry);
        if (exit < entry) {
          takeProfit = exit;
          stopLoss = entry + distance;
        } else {
          stopLoss = exit;
          takeProfit = entry - distance;
        }
        if (!(takeProfit < entry && entry < stopLoss)) {
          console.warn('[DrawingManager] Short position validation failed:', { takeProfit, entry, stopLoss });
          return null;
        }
      }

      const timeMin = Math.min(entryPoint.time, exitPoint.time);
      const timeMax = Math.max(entryPoint.time, exitPoint.time);
      // Extend lines a bit to give visual width
      const timePad = Math.max(Math.floor((timeMax - timeMin) * 0.1), 5);
      const t1 = (timeMin - timePad) as any;
      const t2 = (timeMax + timePad) as any;

      const isLong = type === 'longPosition';

      // Entry line
      const entrySeries = this.chart.addLineSeries({
        color: isLong ? '#22c55e' : '#ef4444',
        lineWidth: 2,
        lineStyle: LineStyle.Solid,
        crosshairMarkerVisible: false,
        lastValueVisible: false,
        priceLineVisible: false,
      });
      entrySeries.setData([
        { time: t1, value: entry },
        { time: t2, value: entry },
      ]);

      // Stop-loss line
      const slSeries = this.chart.addLineSeries({
        color: '#ef4444',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        crosshairMarkerVisible: false,
        lastValueVisible: false,
        priceLineVisible: false,
      });
      slSeries.setData([
        { time: t1, value: stopLoss },
        { time: t2, value: stopLoss },
      ]);

      // Take-profit line
      const tpSeries = this.chart.addLineSeries({
        color: '#22c55e',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        crosshairMarkerVisible: false,
        lastValueVisible: false,
        priceLineVisible: false,
      });
      tpSeries.setData([
        { time: t1, value: takeProfit },
        { time: t2, value: takeProfit },
      ]);

      const id = generateId();
      this.drawings.set(id, {
        id,
        type,
        points: [
          entryPoint,
          exitPoint,
          { time: entryPoint.time, price: stopLoss },
          { time: entryPoint.time, price: takeProfit },
        ],
        seriesRefs: [entrySeries, slSeries, tpSeries],
      });
      return id;
    } catch (err) {
      console.error('[DrawingManager] addPosition error:', err);
      return null;
    }
  }

  // ─── Delete Nearest ────────────────────────────────────────────────

  /**
   * Find and remove the drawing whose first point is nearest to the given click.
   * Returns the removed drawing id if found, null otherwise.
   */
  deleteNearest(clickPoint: DrawingPoint): string | null {
    try {
      if (!this.chart) return null;
      if (!isValidPoint(clickPoint)) return null;

      let nearestId: string | null = null;
      let nearestDist = Infinity;

      for (const [id, drawing] of this.drawings) {
        for (const pt of drawing.points) {
          if (!isValidPoint(pt)) continue;
          // Normalize distance: time might be in seconds, price in dollars.
          // Use a simple Euclidean on normalized values.
          const dt = (clickPoint.time - pt.time) / 60; // normalize to minutes
          const dp = clickPoint.price - pt.price;
          const dist = Math.sqrt(dt * dt + dp * dp);
          if (dist < nearestDist) {
            nearestDist = dist;
            nearestId = id;
          }
        }
      }

      if (nearestId) {
        return this.removeDrawing(nearestId);
      }
      return null;
    } catch (err) {
      console.error('[DrawingManager] deleteNearest error:', err);
      return null;
    }
  }

  /**
   * Remove a specific drawing by id.
   */
  removeDrawing(id: string): string | null {
    try {
      const drawing = this.drawings.get(id);
      if (!drawing) {
        console.warn('[DrawingManager] Drawing not found for removal:', id);
        return null;
      }

      // Remove each series from the chart
      for (const series of drawing.seriesRefs) {
        try {
          if (this.chart) {
            this.chart.removeSeries(series);
          }
        } catch (innerErr) {
          // Series might already have been removed
          console.warn('[DrawingManager] Series removal warning:', innerErr);
        }
      }

      this.drawings.delete(id);
      return id;
    } catch (err) {
      console.error('[DrawingManager] removeDrawing error:', err);
      return null;
    }
  }

  // ─── Cleanup ───────────────────────────────────────────────────────

  /**
   * Remove ALL drawings and their series from the chart.
   * Call on component unmount.
   */
  destroyAll(): void {
    try {
      // Collect IDs first to avoid mutating Map while iterating
      const ids = Array.from(this.drawings.keys());
      for (const id of ids) {
        this.removeDrawing(id);
      }
      this.drawings.clear();
    } catch (err) {
      console.error('[DrawingManager] destroyAll error:', err);
    }
    this.chart = null;
  }
}
