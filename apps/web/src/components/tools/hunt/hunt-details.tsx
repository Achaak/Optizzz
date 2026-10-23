"use client";

// « Détails » of the advanced display: Calystene's estimate, promotions, the surface ↔ losses curve with its slider,
// laying more. As the extension's launcher, without « attendre le retour ». See docs/features/site-chasse.md.
import { unitLabel, UNITS } from "@optizzz/game/army/units";
import { formatAmount, formatCompact, formatNumber } from "@optizzz/game/format/number-format";
import type { CurvePoint } from "@optizzz/game/hunt/extras";
import type { Plan } from "@optizzz/game/hunt/planner";
import type { Extras } from "@optizzz/game/hunt/requests";
import { formatLosses, huntsText } from "@optizzz/game/hunt/texts";
import { useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "~/components/ui/chart";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { Note } from "./hunt-parts";

const signed = (value: number) => `${value >= 0 ? "+" : "−"}${formatAmount(Math.abs(value))}`;

// Two series told apart by their colour, their line (plain, dashed), their axis and the legend.
const CURVE_CONFIG: ChartConfig = {
  lostUnits: { label: "Unités perdues (moyenne)", color: "var(--chart-1)" },
  fieldPerHour: { label: "cm² par heure", color: "var(--chart-2)" },
};

/** Surface ↔ losses: what each hunt surface costs and conquers, with a slider to try one. */
function LossCurve({
  curve,
  amount,
  onPick,
}: {
  curve: CurvePoint[];
  amount: number;
  onPick: (amount: number) => void;
}) {
  // Each surface is a full simulation: the handle moves freely and the plan is asked for once released.
  const [drag, setDrag] = useState<{ value: number; from: number; sent: boolean } | null>(null);
  const shown = drag?.from === amount ? drag.value : amount;
  const release = () => {
    if (!drag || drag.sent || drag.from !== amount || drag.value === amount) return;
    setDrag({ ...drag, sent: true });
    onPick(drag.value);
  };
  const data = curve.map((point) => ({
    amount: point.amount,
    lostUnits: Math.round(point.lostUnits * 10) / 10,
    fieldPerHour: Math.round(point.fieldPerHour),
  }));
  const first = curve[0]?.amount ?? 1;
  const last = curve.at(-1)?.amount ?? first;
  return (
    <div className="space-y-2">
      <ChartContainer config={CURVE_CONFIG} className="aspect-auto h-56 w-full">
        <LineChart data={data} margin={{ left: 4, right: 4 }} accessibilityLayer>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="amount"
            type="number"
            domain={["dataMin", "dataMax"]}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value: number) => formatCompact(value)}
          />
          <YAxis yAxisId="lost" tickLine={false} axisLine={false} width={40} allowDecimals={false} />
          <YAxis
            yAxisId="field"
            orientation="right"
            tickLine={false}
            axisLine={false}
            width={48}
            tickFormatter={(value: number) => formatCompact(value)}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(_, payload) => {
                  const point = payload[0]?.payload as { amount?: number } | undefined;
                  return `${formatNumber(point?.amount ?? 0)} cm² par chasse`;
                }}
                formatter={(value, name) => (
                  <span className="flex w-full justify-between gap-3">
                    <span className="text-muted-foreground">{CURVE_CONFIG[String(name)]?.label}</span>
                    <span className="tabular-nums">{formatNumber(Number(value))}</span>
                  </span>
                )}
              />
            }
          />
          <ChartLegend content={<ChartLegendContent />} />
          <ReferenceLine yAxisId="lost" x={amount} stroke="var(--foreground)" strokeDasharray="2 2" />
          <Line
            yAxisId="lost"
            dataKey="lostUnits"
            type="linear"
            stroke="var(--color-lostUnits)"
            strokeWidth={2}
            dot={false}
          />
          <Line
            yAxisId="field"
            dataKey="fieldPerHour"
            type="linear"
            stroke="var(--color-fieldPerHour)"
            strokeWidth={2}
            strokeDasharray="6 3"
            dot={false}
          />
        </LineChart>
      </ChartContainer>
      <label className="block space-y-1 text-sm">
        <span>
          Surface par chasse : <strong className="tabular-nums">{formatNumber(shown)} cm²</strong>
        </span>
        <input
          type="range"
          className="w-full accent-primary"
          min={first}
          max={last}
          value={shown}
          onChange={(event) => setDrag({ value: Number(event.target.value), from: amount, sent: false })}
          onPointerUp={release}
          onKeyUp={release}
          onBlur={release}
        />
      </label>
    </div>
  );
}

export function HuntDetails({
  plan,
  advised,
  extras,
  custom,
  onPickAmount,
}: {
  plan: Plan;
  /** The advised plan, which the what-ifs are about. */
  advised: Plan | null;
  extras: Extras | null;
  /** The plan is the visitor's own (surface or units changed). */
  custom: boolean;
  onPickAmount: (amount: number) => void;
}) {
  return (
    <div className="space-y-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>N°</TableHead>
            <TableHead title="Pertes selon les tables du simulateur de Calystene, en JSN">
              Pertes selon Calystene
            </TableHead>
            <TableHead title="Pertes de notre simulation : moyenne · 9 fois sur 10 · pire tirage">
              Pertes simulées
            </TableHead>
            <TableHead title="Promotions attendues (moyenne)">Promues</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {plan.hunts.map((hunt, i) => {
            const promoted = UNITS.filter((unit) => (hunt.outcome.promoted[unit.key] ?? 0) >= 0.5)
              .map(
                (unit) =>
                  `${formatAmount(hunt.outcome.promoted[unit.key] ?? 0)} ${unitLabel(unit.key)}→${unitLabel(unit.promotesTo ?? "")}`,
              )
              .join(", ");
            const { calystene } = hunt;
            return (
              <TableRow key={i}>
                <TableHead scope="row">{i + 1}</TableHead>
                <TableCell className="tabular-nums">
                  {Number.isNaN(calystene.average)
                    ? "—"
                    : `${formatLosses(calystene.min)} · ${formatLosses(calystene.average)} · ${formatLosses(calystene.max)} JSN`}
                </TableCell>
                <TableCell className="tabular-nums">
                  {formatLosses(hunt.outcome.lostUnits.mean)} · {formatAmount(hunt.outcome.lostUnits.p90)} ·{" "}
                  {formatAmount(hunt.outcome.lostUnits.max)}
                </TableCell>
                <TableCell>{promoted || "—"}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {extras && extras.curve.length > 1 && (
        <LossCurve curve={extras.curve} amount={plan.hunts[0]?.amount ?? 0} onPick={onPickAmount} />
      )}
      {!extras && <Note>Calcul de la courbe…</Note>}
      {custom && extras && <Note>La courbe et les conseils ci-dessous portent sur le plan conseillé.</Note>}

      {advised && extras && extras.laying.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {extras.laying.map((step) => (
            <li key={step.extra}>
              Avec +{formatAmount(step.extra)} {unitLabel(step.unit)} : {huntsText(step.plan)} (
              {signed(step.plan.totalAmount - advised.totalAmount)} cm²)
            </li>
          ))}
        </ul>
      )}

      <Note>
        Pertes simulées sur 10 000 tirages de proies. Pertes selon Calystene : min · moyenne · max des tables de son
        simulateur de chasse, qui ignorent la composition de l&apos;armée.
      </Note>
    </div>
  );
}
