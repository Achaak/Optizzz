import { LineChart } from "echarts/charts";
import { GridComponent, LegendComponent, TooltipComponent } from "echarts/components";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
// The ESM build: the CommonJS one (lib/core) resolves to the module object instead of the component.
import ReactECharts from "echarts-for-react/esm/core";
import { useMemo } from "react";
import { buildHistoryOption, type Curve } from "./chart-option";

echarts.use([LineChart, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer]);

interface Props {
  curves: Curve[];
  compact?: boolean;
}

export function HistoryChart({ curves, compact = false }: Props) {
  const option = useMemo(() => buildHistoryOption(curves, compact), [curves, compact]);
  return (
    <ReactECharts echarts={echarts} option={option} notMerge style={{ height: compact ? 220 : 380, width: "100%" }} />
  );
}
