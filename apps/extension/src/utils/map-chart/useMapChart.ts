import type ReactECharts from "echarts-for-react/esm/core";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AxisRange } from "./axes";

/**
 * The box a map is drawn in, its size and zoom. The plot area must keep the map's shape for both axes to share a
 * scale: its height depends on the width actually given (`heightFor`), so the chart is drawn once that width is known
 * (`width > 0`).
 */
export function useMapChart(heightFor: (width: number) => number) {
  const chartRef = useRef<ReactECharts>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const observer = new ResizeObserver(([entry]) => {
      // A hidden view measures 0: keep the last width.
      const measured = Math.round(entry?.contentRect.width ?? 0);
      if (measured > 0) setWidth(measured);
    });
    observer.observe(box);
    return () => {
      observer.disconnect();
    };
  }, []);

  const zoomTo = useCallback((x: AxisRange, y: AxisRange) => {
    const chart = chartRef.current?.getEchartsInstance();
    chart?.dispatchAction({ type: "dataZoom", dataZoomIndex: 0, startValue: x[0], endValue: x[1] });
    chart?.dispatchAction({ type: "dataZoom", dataZoomIndex: 1, startValue: y[0], endValue: y[1] });
  }, []);

  const resetZoom = useCallback(() => {
    const chart = chartRef.current?.getEchartsInstance();
    for (const dataZoomIndex of [0, 1]) chart?.dispatchAction({ type: "dataZoom", dataZoomIndex, start: 0, end: 100 });
  }, []);

  return { chartRef, boxRef, width, height: heightFor(width), zoomTo, resetZoom };
}
