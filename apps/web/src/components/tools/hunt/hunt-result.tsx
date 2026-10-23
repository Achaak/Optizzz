"use client";

// « Informations sur la chasse » and « Pertes selon le TdC à l'arrivée » of the advanced display, as the extension's
// launcher shows them. See docs/features/site-chasse.md.
import { formatAmount, formatDecimal } from "@optizzz/game/format/number-format";
import { formatDuration, formatEndTime } from "@optizzz/game/format/time-format";
import type { Spread } from "@optizzz/game/hunt/evaluate";
import type { FieldRow } from "@optizzz/game/hunt/extras";
import type { Plan } from "@optizzz/game/hunt/planner";
import { formatChance, formatLosses, formatShare, splitText, stepNotice } from "@optizzz/game/hunt/texts";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { Note, Warning } from "./hunt-parts";

const SPREADS: { key: keyof Spread; label: string }[] = [
  { key: "min", label: "Min" },
  { key: "mean", label: "Moyenne" },
  { key: "p90", label: "9 fois sur 10" },
  { key: "max", label: "Pire tirage" },
];

const total = (plan: Plan, pick: (hunt: Plan["hunts"][number]) => Spread): Spread =>
  plan.hunts.reduce(
    (sum, hunt) => {
      const spread = pick(hunt);
      return {
        min: sum.min + spread.min,
        mean: sum.mean + spread.mean,
        p90: sum.p90 + spread.p90,
        max: sum.max + spread.max,
      };
    },
    { min: 0, mean: 0, p90: 0, max: 0 },
  );

export function HuntResult({
  plan,
  field,
  layingSpeed,
  wavesAsked,
  now,
}: {
  plan: Plan;
  /** Field the first hunt fights at. */
  field: number;
  /** Factor of the units' laying times, null when the laying levels are not all given. */
  layingSpeed: number | null;
  wavesAsked: boolean;
  now: Date;
}) {
  const difficulty = plan.hunts.reduce((sum, hunt) => sum + hunt.difficulty, 0);
  const attack = plan.hunts.reduce((sum, hunt) => sum + hunt.attack, 0);
  const references = [...new Set(plan.hunts.map((hunt) => hunt.calystene.referenceRatio))];
  const lost = total(plan, (hunt) => hunt.outcome.lostUnits);
  const laying = total(plan, (hunt) => hunt.outcome.lossLayingSeconds);
  const winChance = Math.min(...plan.hunts.map((hunt) => hunt.outcome.winChance));
  const facts: [string, string][] = [
    ["TdC total chassé", `${formatAmount(plan.totalAmount)} cm²`],
    ["Durée de la chasse", formatDuration(plan.durationSeconds * 1000)],
    ["Division des chasses", splitText(plan.hunts.map((hunt) => hunt.amount))],
    ["Retour de chasse", formatEndTime(new Date(now.getTime() + plan.durationSeconds * 1000), now)],
    ["Rentabilité", `${formatAmount(plan.fieldPerHour * 24)} cm² / jour`],
    ["Nourriture récoltée", formatAmount(plan.hunts.reduce((sum, hunt) => sum + hunt.outcome.food, 0))],
    ["Ratio de votre chasse", difficulty > 0 ? formatDecimal(attack / difficulty, 2) : "—"],
    ["Difficulté de la chasse", formatAmount(difficulty)],
    ["Répartition", plan.waves === "applied" ? "par vagues" : "mêlée"],
    [
      "Ratio de référence (Calystene)",
      references.map((reference) => (reference === null ? "sous 1" : formatDecimal(reference))).join(", "),
    ],
  ];
  return (
    <div className="space-y-3">
      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        {facts.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3 border-b border-border/60 pb-1">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="text-right font-medium tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      {wavesAsked && plan.waves === "worse" && (
        <Warning>
          Unités mêlées malgré la répartition par vagues : par vagues, ces chasses perdraient plus de troupes (hors JSN)
          ou en promouvraient moins. À un ratio plus haut, les vagues protègent mieux les troupes qui montent.
        </Warning>
      )}
      {wavesAsked && plan.waves === undefined && (
        <Note>
          {plan.hunts.length === 1
            ? "Une seule chasse : la répartition par vagues ne change rien."
            : "Aucune unité à faire monter à part les JSN : la répartition par vagues ne change rien."}
        </Note>
      )}
      {winChance < 1 && (
        <Warning danger>
          Chasse perdue dans {formatChance(1 - winChance)} des tirages : l&apos;armée ne suffit pas.
        </Warning>
      )}

      <Table>
        <TableCaption>
          Estimation des pertes{plan.hunts.length > 1 ? ", toutes chasses additionnées" : ""}
          {layingSpeed === null && " ; donnez Couveuse, Solarium et Technique de ponte pour les voir en temps de ponte"}
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead />
            {SPREADS.map(({ key, label }) => (
              <TableHead key={key} className="text-right">
                {label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableHead scope="row">Unités perdues</TableHead>
            {SPREADS.map(({ key }) => (
              <TableCell key={key} className="text-right tabular-nums">
                {formatLosses(lost[key])}
              </TableCell>
            ))}
          </TableRow>
          {layingSpeed !== null && (
            <>
              <TableRow>
                <TableHead scope="row">Temps de ponte</TableHead>
                {SPREADS.map(({ key }) => (
                  <TableCell key={key} className="text-right tabular-nums">
                    {formatDuration(laying[key] * layingSpeed * 1000)}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow>
                <TableHead scope="row">Part de la durée de chasse</TableHead>
                {SPREADS.map(({ key }) => (
                  <TableCell key={key} className="text-right tabular-nums">
                    {plan.durationSeconds > 0 ? formatShare((laying[key] * layingSpeed) / plan.durationSeconds) : "—"}
                  </TableCell>
                ))}
              </TableRow>
            </>
          )}
        </TableBody>
      </Table>
      <Note>
        Une unité blessée à plus de la moitié de sa vie compte comme perdue. {stepNotice(field, plan.totalAmount)}
      </Note>
    </div>
  );
}

/** « Pertes selon le TdC à l'arrivée »: the same hunts if the field has changed by the time they fight. */
export function FieldTable({ rows, field }: { rows: FieldRow[]; field: number }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>TdC à l&apos;arrivée</TableHead>
          <TableHead className="text-right">Difficulté</TableHead>
          <TableHead className="text-right">Ratio</TableHead>
          <TableHead className="text-right">Pertes moy.</TableHead>
          <TableHead className="text-right">9 fois sur 10</TableHead>
          <TableHead className="text-right">Pire tirage</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.field} data-state={row.field === field ? "selected" : undefined}>
            <TableHead scope="row" className="tabular-nums">
              {formatAmount(row.field)} cm²
              {row.field === field && <span className="font-normal text-muted-foreground"> (prévu)</span>}
            </TableHead>
            <TableCell className="text-right tabular-nums">{formatAmount(row.difficulty)}</TableCell>
            <TableCell className="text-right tabular-nums">{formatDecimal(row.ratio, 2)}</TableCell>
            <TableCell className="text-right tabular-nums">{formatLosses(row.lostUnits.mean)}</TableCell>
            <TableCell className="text-right tabular-nums">{formatAmount(row.lostUnits.p90)}</TableCell>
            <TableCell className="text-right tabular-nums">
              {formatAmount(row.lostUnits.max)}
              {row.winChance < 1 && <span> · ⚠ échec {formatChance(1 - row.winChance)}</span>}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
