import { GraphChart } from "echarts/charts";
import { DataZoomComponent, GridComponent, TooltipComponent } from "echarts/components";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
// The ESM build: the CommonJS one (lib/core) resolves to the module object instead of the component.
import ReactECharts from "echarts-for-react/esm/core";
import { useEffect, useMemo, useRef, useState } from "react";
import { buildChartOption, chartHeightFor, zoomWindowAround, type MapMember } from "./chart-option";
import type { KnownLevels } from "./neighbor-table";

echarts.use([GraphChart, GridComponent, TooltipComponent, DataZoomComponent, CanvasRenderer]);

interface ChartEvent {
  dataType?: string;
  dataIndex: number;
}

interface Props {
  members: MapMember[];
  selected: MapMember;
  k: number;
  levels: KnownLevels;
  onSelect: (playerId: number) => void;
}

const MAX_HEIGHT = 640;

export function MapChart({ members, selected, k, levels, onSelect }: Props) {
  const chartRef = useRef<ReactECharts>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  // The plot area must be square for both axes to share a scale: it depends on the width actually given.
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
  const height = chartHeightFor(width, MAX_HEIGHT);
  const option = useMemo(
    () => buildChartOption(members, selected, k, levels, { width, height }),
    [members, selected, k, levels, width, height],
  );

  const zoomTo = (x: readonly number[], y: readonly number[]) => {
    const chart = chartRef.current?.getEchartsInstance();
    chart?.dispatchAction({ type: "dataZoom", dataZoomIndex: 0, startValue: x[0], endValue: x[1] });
    chart?.dispatchAction({ type: "dataZoom", dataZoomIndex: 1, startValue: y[0], endValue: y[1] });
  };

  const resetZoom = () => {
    const chart = chartRef.current?.getEchartsInstance();
    for (const dataZoomIndex of [0, 1]) chart?.dispatchAction({ type: "dataZoom", dataZoomIndex, start: 0, end: 100 });
  };

  const memberAt = (event: ChartEvent) => (event.dataType === "node" ? members[event.dataIndex] : undefined);

  const onEvents = {
    click: (event: ChartEvent) => {
      const member = memberAt(event);
      if (member) onSelect(member.id);
    },
    dblclick: (event: ChartEvent) => {
      const member = memberAt(event);
      if (!member) return;
      onSelect(member.id);
      const { x, y } = zoomWindowAround(member, members, k);
      zoomTo(x, y);
    },
  };

  return (
    <div className="chart">
      <div className="chart-toolbar">
        <span className="hint">
          Ctrl + molette ou pincer : zoom · Glisser : déplacer · Double-clic : zoomer sur un joueur
        </span>
        <button type="button" onClick={resetZoom}>
          Réinitialiser le zoom
        </button>
      </div>
      <div ref={boxRef}>
        {width > 0 && (
          <ReactECharts
            ref={chartRef}
            echarts={echarts}
            option={option}
            onEvents={onEvents}
            lazyUpdate
            style={{ width: "100%", height }}
          />
        )}
      </div>
    </div>
  );
}
