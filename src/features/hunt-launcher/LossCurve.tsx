import { LineChart } from "echarts/charts";
import { GridComponent, LegendComponent, MarkLineComponent, TooltipComponent } from "echarts/components";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
// The ESM build: the CommonJS one (lib/core) resolves to the module object instead of the component.
import ReactECharts from "echarts-for-react/esm/core";
import { useMemo, useState } from "react";
import type { CurvePoint } from "./engine/extras";
import { CHART_COLORS } from "@/theme";
import { formatNumber } from "@/utils/number-format";

echarts.use([LineChart, GridComponent, TooltipComponent, LegendComponent, MarkLineComponent, CanvasRenderer]);

interface Props {
  curve: CurvePoint[];
  /** Surface of the plan shown. */
  amount: number;
  onPick: (amount: number) => void;
}

/** Surface ↔ losses: what each hunt surface costs and conquers, with a slider to try one. */
export function LossCurve({ curve, amount, onPick }: Props) {
  // Each surface is a full simulation: the handle moves freely and the plan is asked for once released.
  const [drag, setDrag] = useState<{ value: number; from: number; sent: boolean } | null>(null);
  const shown = drag?.from === amount ? drag.value : amount;
  const release = () => {
    if (!drag || drag.sent || drag.from !== amount || drag.value === amount) return;
    setDrag({ ...drag, sent: true });
    onPick(drag.value);
  };
  const option = useMemo(
    () => ({
      animation: false,
      color: [...CHART_COLORS.series],
      grid: { left: 48, right: 56, top: 28, bottom: 48 },
      legend: { bottom: 0, textStyle: { fontSize: 11 } },
      tooltip: { trigger: "axis" },
      xAxis: { type: "value", name: "cm²", min: "dataMin", max: "dataMax" },
      yAxis: [
        { type: "value", name: "Pertes", minInterval: 1 },
        { type: "value", name: "cm²/h", splitLine: { show: false } },
      ],
      series: [
        {
          name: "Unités perdues (moyenne)",
          type: "line",
          showSymbol: false,
          data: curve.map((point) => [point.amount, Math.round(point.lostUnits * 10) / 10]),
          markLine: {
            symbol: "none",
            silent: true,
            label: { show: false },
            data: [{ xAxis: amount }],
            lineStyle: { color: CHART_COLORS.marker },
          },
        },
        {
          name: "cm² par heure",
          type: "line",
          yAxisIndex: 1,
          showSymbol: false,
          data: curve.map((point) => [point.amount, Math.round(point.fieldPerHour)]),
        },
      ],
    }),
    [curve, amount],
  );
  const first = curve[0]?.amount ?? 1;
  const last = curve.at(-1)?.amount ?? first;

  return (
    <div className="curve">
      <ReactECharts echarts={echarts} option={option} lazyUpdate style={{ width: "100%", height: 200 }} />
      <label className="slider">
        Surface par chasse : <strong>{formatNumber(shown)} cm²</strong>
        <input
          type="range"
          min={first}
          max={last}
          value={shown}
          onChange={(event) => {
            setDrag({ value: Number(event.target.value), from: amount, sent: false });
          }}
          onPointerUp={release}
          onKeyUp={release}
          onBlur={release}
        />
      </label>
    </div>
  );
}
