// The flood simulator's result, as the extension's « Plan de flood »: what stops the plan, then a table of the
// attacks with a Total line, and the rules used. The plan itself is shared (@optizzz/game/site-links/flood).
// See docs/features/site-flood.md.
import { UNITS, unitLabel, type Army } from "@optizzz/game/army/units";
import { FLOOD_MARGIN, floodBlockText } from "@optizzz/game/flood";
import { formatNumber } from "@optizzz/game/format/number-format";
import type { FloodField, FloodToolPlan } from "@optizzz/game/site-links/flood";
import { Stat } from "~/components/stat";
import { FloodChart } from "./flood-chart";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "~/components/ui/table";

/** « 400 JSN », « 2 T »: each unit sent, as the game abbreviates them. */
const armyParts = (army: Army) =>
  UNITS.flatMap((unit, i) => ((army[i] ?? 0) > 0 ? [`${formatNumber(army[i] ?? 0)} ${unitLabel(unit.key)}`] : []));

/** « 400 JSN, 2 T ». */
export const armyText = (army: Army) => armyParts(army).join(", ");

/** An army in a table cell: a unit is never cut across two lines. */
function ArmyCell({ army, empty = "" }: { army: Army; empty?: string }) {
  const parts = armyParts(army);
  return (
    <TableCell className="min-w-28 whitespace-normal">
      {parts.length === 0
        ? empty
        : parts.map((part, i) => (
            <span key={part} className="whitespace-nowrap">
              {part}
              {i < parts.length - 1 && ", "}
            </span>
          ))}
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

/** What stops the plan: framed, and said in words with a sign (never by colour alone). */
function Callout({ text }: { text: string }) {
  return (
    <p role="note" className="border border-warning-border bg-warning-soft px-3 py-2 text-sm">
      ⚠ {text}
    </p>
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
  const last = attacks.at(-1);
  const taken = attacks.reduce((sum, attack) => sum + attack.take, 0);
  // Losses only matter against a defense: a column then, nothing otherwise.
  const withLosses = attacks.some((attack) => attack.lost);
  return (
    <>
      <div className="grid grid-cols-2 border-t border-l">
        <Stat label="Attaques possibles" value={String(plan.slots)} />
        {last && <Stat label="Prise totale" value={`${formatNumber(taken)} cm²`} />}
        {trip && <Stat label="Trajet" value={trip.time} />}
        {trip && <Stat label="Arrivée si vous lancez maintenant" value={trip.arrivalText} />}
      </div>
      {trip && <p className="text-sm text-muted-foreground">Heure de Paris.</p>}
      {block && <Callout text={floodBlockText(block, targetName, FLOOD_MARGIN)} />}
      {last && <FloodChart attacks={attacks} targetName={targetName} />}
      {last && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>N°</TableHead>
              <TableHead>Armée</TableHead>
              {withLosses && <TableHead>Pertes</TableHead>}
              <TableHead className="text-right">Prise</TableHead>
              <TableHead className="text-right">Son TDC après</TableHead>
              <TableHead className="text-right">Mon TDC après</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {attacks.map((attack, index) => (
              <TableRow key={index}>
                <TableCell>{index + 1}</TableCell>
                <ArmyCell army={attack.army} />
                {withLosses && (attack.lost ? <ArmyCell army={attack.lost} empty="aucune" /> : <TableCell />)}
                <TableCell className="text-right tabular-nums">{formatNumber(attack.take)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatNumber(attack.targetAfter)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatNumber(attack.attackerAfter)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={withLosses ? 3 : 2}>Total, {plural(attacks.length, "attaque")}</TableCell>
              <TableCell className="text-right tabular-nums">{formatNumber(taken)} cm²</TableCell>
              <TableCell className="text-right tabular-nums">{formatNumber(last.targetAfter)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatNumber(last.attackerAfter)}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      )}
      <details className="text-sm text-muted-foreground">
        <summary className="cursor-pointer">Règles utilisées (non vérifiées sur un vrai flood)</summary>
        <p className="mt-2">
          20 % de son TDC par attaque, 1 cm² par fourmi au plus, portée 50–300 % revérifiée à chaque arrivée, avec{" "}
          {formatNumber(FLOOD_MARGIN * 100)} % de marge au-dessus de 50 %. Vitesse d&apos;attaque + 1 attaques en même
          temps (comme le simulateur de flood du jeu). Sans défense, les unités les moins chères partent d&apos;abord ;
          contre une défense, la première attaque est la plus petite armée, des plus fortes aux plus faibles, qui gagne
          avec une riposte à 10 % au plus. Les attaques et chasses des autres joueurs peuvent changer les TDC avant
          l&apos;arrivée.
        </p>
      </details>
    </>
  );
}
