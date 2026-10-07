import { GraphChart } from "echarts/charts";
import { DataZoomComponent, GridComponent, TooltipComponent } from "echarts/components";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
// The ESM build: the CommonJS one (lib/core) resolves to the module object instead of the component.
import ReactECharts from "echarts-for-react/esm/core";
import { useMemo, useRef } from "react";
import { buildChartOption, zoomWindowAround, type MapMember } from "./chart-option";
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

export function MapChart({ members, selected, k, levels, onSelect }: Props) {
  const chartRef = useRef<ReactECharts>(null);
  const option = useMemo(() => buildChartOption(members, selected, k, levels), [members, selected, k, levels]);

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
        <span className="hint">Molette ou pincer : zoom · Glisser : déplacer · Double-clic : zoomer sur un joueur</span>
        <button type="button" onClick={resetZoom}>
          Réinitialiser le zoom
        </button>
      </div>
      <ReactECharts
        ref={chartRef}
        echarts={echarts}
        option={option}
        onEvents={onEvents}
        lazyUpdate
        style={{ width: "100%", height: "min(640px, 85vw)" }}
      />
    </div>
  );
}
