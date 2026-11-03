// The flood simulator's report, as the « Campagne » mockup draws it: the number of attacks and when they land, what
// they take and what is left of the target, what stops the plan, both TDC attack after attack, then each attack.
// The plan itself is shared (@optizzz/game/site-links/flood). See docs/features/site-flood.md.
import { UNITS, unitLabel, type Army } from "@optizzz/game/army/units";
import { FLOOD_MARGIN, floodBlockText } from "@optizzz/game/flood";
import { formatNumber } from "@optizzz/game/format/number-format";
import type { FloodField, FloodToolPlan } from "@optizzz/game/site-links/flood";
import { cn } from "cn";
import { Fragment } from "react";
import { SmallLabel } from "~/components/panel";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { Verdict } from "../tool-page";
import { FloodChart } from "./flood-chart";

/** « 400 JSN », « 2 T »: each unit sent, as the game abbreviates them. */
const armyParts = (army: Army) =>
  UNITS.flatMap((unit, i) => ((army[i] ?? 0) > 0 ? [`${formatNumber(army[i] ?? 0)} ${unitLabel(unit.key)}`] : []));

/** « 400 JSN, 2 T ». */
export const armyText = (army: Army) => armyParts(army).join(", ");

/** The report's table: 8 px between columns, 16 px at its edges, as its panel. */
const CELL = "px-2 first:pl-4 last:pr-4";
const HEAD = cn(CELL, "h-auto py-2 text-xs font-medium text-muted-foreground");
const NUMBER = cn(CELL, "py-1.5 text-right font-mono tabular-nums");

/** « 400 JSN, 2 T », a unit never cut across two lines. */
function ArmyList({ army }: { army: Army }) {
  const parts = armyParts(army);
  return parts.map((part, i) => (
    <Fragment key={part}>
      <span className="whitespace-nowrap">{part}</span>
      {i < parts.length - 1 && ", "}
    </Fragment>
  ));
}

/** The army an attack sends, and against a defense what it loses, under it. */
function ArmyCell({ army, lost }: { army: Army; lost: Army | null }) {
  return (
    <TableCell className={cn(CELL, "min-w-24 py-1.5 whitespace-normal")}>
      <ArmyList army={army} />
      {lost && (
        <span className="block text-xs text-muted-foreground">
          {lost.some((count) => count > 0) ? (
            <>
              pertes : <ArmyList army={lost} />
            </>
          ) : (
            "aucune perte"
          )}
        </span>
      )}
    </TableCell>
  );
}

const plural = (count: number, word: string) => `${formatNumber(count)} ${word}${count > 1 ? "s" : ""}`;

const FIELD_LABELS: Record<FloodField, string> = {
  attackerField: "votre TDC",
  targetField: "le TDC de la cible",
  attackSpeed: "votre Vitesse d'attaque",
  weapons: "votre niveau d'Armes",
  shield: "votre niveau de Bouclier Thoracique",
};

/** « a, b et c ». */
const listText = (items: string[]) =>
  items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} et ${items.at(-1) ?? ""}`;

function missingText(fields: FloodField[]) {
  return `Saisissez ${listText(fields.map((field) => FIELD_LABELS[field]))}.`;
}

/**
 * One figure of the report, its label in the colour of its line in the chart (amber mine, blue the target's): the
 * label says what it is, the colour only ties it to the chart (ADR 0003).
 */
function Figure({
  label,
  value,
  hint,
  tone,
  className,
}: {
  label: string;
  value: string;
  hint: string;
  tone: "primary" | "info";
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 px-4 py-3.5", className)}>
      <SmallLabel className={cn("block", tone === "primary" ? "text-primary" : "text-info")}>{label}</SmallLabel>
      <div className="truncate font-mono text-[1.375rem] tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground">{hint}</div>
    </div>
  );
}

export interface Trip {
  time: string;
  arrivalText: string;
}

export function FloodResult({
  plan,
  targetName,
  trip,
}: {
  plan: FloodToolPlan;
  /** The chosen target's pseudo, else « La cible ». */
  targetName: string;
  trip: Trip | null;
}) {
  if (plan.kind === "missing") return <p className="text-sm text-muted-foreground">{missingText(plan.fields)}</p>;
  const { attacks, block } = plan;
  const first = attacks[0];
  const last = attacks.at(-1);
  const taken = attacks.reduce((sum, attack) => sum + attack.take, 0);
  const targetBefore = first ? first.targetAfter + first.take : 0;
  const arrival = trip ? `arrivée ${trip.arrivalText} (heure de Paris), après ${trip.time} de trajet` : null;
  return (
    // The report draws its own rules, edge to edge of its panel.
    <div className="-m-4">
      {/* The verdict breaks out of its panel's padding: give it back. */}
      <div className="px-4 pt-4">
        {first && last ? (
          <Verdict title={plural(attacks.length, "attaque")}>
            {targetName} finit à {formatNumber(last.targetAfter)} cm²{arrival && ` · ${arrival}`}
          </Verdict>
        ) : (
          <Verdict title="Aucune attaque">{targetName} est hors de portée.</Verdict>
        )}
      </div>
      {first && last && (
        <div className="grid grid-cols-2 border-b">
          <Figure
            label="Prise totale"
            value={`+ ${formatNumber(taken)}`}
            hint={`cm², sur ${plural(plan.slots, "attaque")} possible${plan.slots > 1 ? "s" : ""}`}
            tone="primary"
            className="border-r"
          />
          <Figure
            label="Terrain de la cible"
            value={`− ${formatNumber(Math.round((taken / targetBefore) * 100))} %`}
            hint={`${formatNumber(targetBefore)} → ${formatNumber(last.targetAfter)}`}
            tone="info"
          />
        </div>
      )}
      {block && (
        <p role="note" className="border-b bg-warning-soft px-4 py-2.5 text-sm">
          ⚠ {floodBlockText(block, targetName, FLOOD_MARGIN)}
        </p>
      )}
      {last && (
        <figure className="border-b">
          <figcaption className="px-4 pt-3 font-heading text-lg font-semibold tracking-wide uppercase">
            TDC au fil des attaques
          </figcaption>
          <FloodChart attacks={attacks} targetName={targetName} />
        </figure>
      )}
      {last && (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className={HEAD}>#</TableHead>
              <TableHead className={HEAD}>Armée</TableHead>
              <TableHead className={cn(HEAD, "text-right")}>Prise</TableHead>
              <TableHead className={cn(HEAD, "text-right")}>Mon TDC</TableHead>
              <TableHead className={cn(HEAD, "text-right")}>Son TDC</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {attacks.map((attack, index) => (
              <TableRow key={index}>
                <TableCell className={cn(CELL, "py-1.5")}>{index + 1}</TableCell>
                <ArmyCell army={attack.army} lost={attack.lost} />
                <TableCell className={NUMBER}>{formatNumber(attack.take)}</TableCell>
                <TableCell className={NUMBER}>{formatNumber(attack.attackerAfter)}</TableCell>
                <TableCell className={NUMBER}>{formatNumber(attack.targetAfter)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
