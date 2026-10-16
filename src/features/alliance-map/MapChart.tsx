import { GraphChart } from "echarts/charts";
import { DataZoomComponent, GridComponent, TooltipComponent } from "echarts/components";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
// The ESM build: the CommonJS one (lib/core) resolves to the module object instead of the component.
import ReactECharts from "echarts-for-react/esm/core";
import { useMemo } from "react";
import { buildChartOption, zoomWindowAround, type MapMember } from "./chart-option";
import type { KnownLevels } from "./neighbor-table";
import type { MemberBubble } from "@/features/tdc-chain/role-styles";
import { chartHeightFor } from "@/utils/map-chart/axes";
import { useMapChart } from "@/utils/map-chart/useMapChart";

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
  /** Each member's chain role bubble, when the map shows them. */
  bubbles: ReadonlyMap<number, MemberBubble> | null;
  onSelect: (playerId: number) => void;
}

const MAX_HEIGHT = 640;

export function MapChart({ members, selected, k, levels, bubbles, onSelect }: Props) {
  const { chartRef, boxRef, width, height, zoomTo, resetZoom } = useMapChart((width) =>
    chartHeightFor(width, MAX_HEIGHT),
  );
  const option = useMemo(
    () => buildChartOption(members, selected, k, levels, { width, height }, bubbles),
    [members, selected, k, levels, width, height, bubbles],
  );

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
