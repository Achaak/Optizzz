// ECharts option of the history curves.
import type { EChartsCoreOption } from "echarts/core";
import { CHART_COLORS } from "@/theme";
import { formatNumber } from "@/utils/number-format";
import { formatDateTime } from "@/utils/time-format";
import type { Point } from "./series";

export interface Curve {
  name: string;
  points: Point[];
  /** Drawn thicker: me, or the profile's player. */
  highlight?: boolean;
  dashed?: boolean;
}

const day = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "Europe/Paris" });

interface TooltipParam {
  seriesName: string;
  marker: string;
  data: { value: [number, number]; live: boolean };
}

export function buildHistoryOption(curves: readonly Curve[], compact: boolean): EChartsCoreOption {
  return {
    animation: false,
    color: [...CHART_COLORS.series],
    grid: { left: 8, right: 16, top: compact ? 12 : 36, bottom: 8, containLabel: true },
    legend: compact ? undefined : { type: "scroll", top: 0 },
    tooltip: {
      trigger: "item",
      formatter: (param: TooltipParam) =>
        `${formatDateTime(new Date(param.data.value[0]))}${param.data.live ? " · en direct" : ""}<br>` +
        `${param.marker}${param.seriesName} : <b>${formatNumber(param.data.value[1])}</b>`,
    },
    xAxis: { type: "time", axisLabel: { formatter: (value: number) => day.format(value), hideOverlap: true } },
    yAxis: { type: "value", scale: true, axisLabel: { formatter: (value: number) => formatNumber(value) } },
    series: curves.map((curve) => ({
      type: "line",
      name: curve.name,
      showSymbol: true,
      symbol: "circle",
      symbolSize: curve.highlight ? 7 : 5,
      lineStyle: { width: curve.highlight ? 3 : 1.5, type: curve.dashed ? "dashed" : "solid" },
      emphasis: { focus: "series" },
      data: curve.points.map((point) => ({
        value: [point.time, point.value],
        live: point.live,
        // The live point is hollow: it is not an export.
        ...(point.live && { symbol: "emptyCircle", symbolSize: 9 }),
      })),
    })),
  };
}
