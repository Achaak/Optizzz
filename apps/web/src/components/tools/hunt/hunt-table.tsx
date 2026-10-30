"use client";

// The hunts, one row each with the totals under them; in the advanced display, more columns can be shown and the hunts
// changed by hand (« Modifier les chasses »). No launch here: the site never acts in the game. See
// docs/features/site-chasse.md.
import { unitLabel, UNITS } from "@optizzz/game/army/units";
import { formatAmount, formatDecimal, formatNumber } from "@optizzz/game/format/number-format";
import { formatEndTimeShort } from "@optizzz/game/format/time-format";
import type { Plan } from "@optizzz/game/hunt/planner";
import { formatLosses } from "@optizzz/game/hunt/texts";
import { cn } from "cn";
import { NumberField } from "~/components/number-field";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { AMOUNT } from "./hunt-entries";
import type { HuntEdit } from "./hunt-settings";
import { Check } from "./hunt-parts";

/** Columns shown besides number, surface and units, as « Paramétrage affichage » in Calystene's simulator. */
export type ColumnKey = "emptyUnits" | "difficulty" | "ratio" | "meanLosses" | "maxLosses" | "returns" | "edit";

export const NO_COLUMNS: Record<ColumnKey, boolean> = {
  emptyUnits: false,
  difficulty: false,
  ratio: false,
  meanLosses: false,
  maxLosses: false,
  returns: false,
  edit: false,
};

const COLUMN_OPTIONS: { key: ColumnKey; label: string }[] = [
  { key: "emptyUnits", label: "Unités sans effectif" },
  { key: "difficulty", label: "Difficulté" },
  { key: "ratio", label: "Ratio réel" },
  { key: "meanLosses", label: "Pertes moyennes" },
  { key: "maxLosses", label: "Pertes au pire tirage" },
  { key: "returns", label: "Heure de retour" },
  { key: "edit", label: "Modifier les chasses" },
];

const NUMBER = "text-right tabular-nums";

export function ColumnChoices({
  columns,
  onColumn,
}: {
  columns: Record<ColumnKey, boolean>;
  onColumn: (column: ColumnKey, shown: boolean) => void;
}) {
  return (
    <fieldset className="flex flex-wrap gap-x-4 gap-y-2">
      <legend className="mb-2 text-sm font-medium">Afficher aussi</legend>
      {COLUMN_OPTIONS.map(({ key, label }) => (
        <Check key={key} checked={columns[key]} onChange={(shown) => onColumn(key, shown)}>
          {label}
        </Check>
      ))}
    </fieldset>
  );
}

/** The hunts that follow one another with the same surface and units, as one row: « 1 à 6 », « 7 et 8 ». */
interface Group {
  first: number;
  last: number;
}

function groups(plan: Plan): Group[] {
  const same = (a: Plan["hunts"][number], b: Plan["hunts"][number]) =>
    a.amount === b.amount && a.army.length === b.army.length && a.army.every((count, i) => count === b.army[i]);
  const result: Group[] = [];
  plan.hunts.forEach((hunt, i) => {
    const previous = result.at(-1);
    const head = previous && plan.hunts[previous.first];
    if (previous && head && same(head, hunt)) previous.last = i;
    else result.push({ first: i, last: i });
  });
  return result;
}

const groupName = ({ first, last }: Group) =>
  first === last
    ? String(first + 1)
    : last === first + 1
      ? `${String(first + 1)} et ${String(last + 1)}`
      : `${String(first + 1)} à ${String(last + 1)}`;

export function HuntTable({
  plan,
  unitKeys,
  columns,
  grouped = false,
  flush = false,
  now,
  onEdit,
}: {
  plan: Plan;
  /** Units of the army sent. */
  unitKeys: string[];
  columns: Record<ColumnKey, boolean>;
  /** The same hunts one after another as one row (never while they are changed by hand). */
  grouped?: boolean;
  /** Right against the report's edges: the first and last columns keep the report's margin. */
  flush?: boolean;
  now: Date;
  onEdit: (hunt: number, edit: HuntEdit) => void;
}) {
  const sent = UNITS.map((_, i) => plan.hunts.reduce((sum, hunt) => sum + (hunt.army[i] ?? 0), 0));
  const units = UNITS.filter(
    (unit, i) => unitKeys.includes(unit.key) && (columns.emptyUnits || columns.edit || (sent[i] ?? 0) > 0),
  );
  const sum = (pick: (hunt: Plan["hunts"][number]) => number) => plan.hunts.reduce((s, hunt) => s + pick(hunt), 0);
  const rows: Group[] = grouped && !columns.edit ? groups(plan) : plan.hunts.map((_, i) => ({ first: i, last: i }));
  return (
    <Table className={cn("text-[0.8125rem]", flush && "[&_tr>*:first-child]:pl-4 [&_tr>*:last-child]:pr-4")}>
      <TableHeader>
        <TableRow>
          <TableHead>Chasse</TableHead>
          <TableHead className="text-right">TdC</TableHead>
          {units.map((unit) => (
            <TableHead key={unit.key} className="text-right" title={unit.name}>
              {unitLabel(unit.key)}
            </TableHead>
          ))}
          {columns.difficulty && <TableHead className="text-right">Difficulté</TableHead>}
          {columns.ratio && (
            <TableHead className="text-right" title="Attaque (bonus Armes compris) / difficulté">
              Ratio
            </TableHead>
          )}
          {columns.meanLosses && <TableHead className="text-right">Pertes moy.</TableHead>}
          {columns.maxLosses && <TableHead className="text-right">Pertes max</TableHead>}
          {columns.returns && <TableHead className="text-right">Retour</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const i = row.first;
          const hunt = plan.hunts[i];
          if (!hunt) return null;
          return (
            <TableRow key={i}>
              <TableHead scope="row">{groupName(row)}</TableHead>
              <TableCell className={NUMBER}>
                {columns.edit ? (
                  <NumberField
                    aria-label={`Surface de la chasse ${String(i + 1)}`}
                    className="ml-auto w-28 min-w-28 text-right tabular-nums"
                    value={hunt.amount}
                    onCommit={(amount) => {
                      if (amount !== null) onEdit(i, { amount });
                    }}
                    rules={{ ...AMOUNT, min: 1, allowEmpty: false }}
                  />
                ) : (
                  formatNumber(hunt.amount)
                )}
              </TableCell>
              {units.map((unit) => {
                const index = UNITS.indexOf(unit);
                return (
                  <TableCell key={unit.key} className={NUMBER}>
                    {columns.edit ? (
                      <NumberField
                        aria-label={`${unit.name}, chasse ${String(i + 1)}`}
                        className="ml-auto w-24 min-w-24 text-right tabular-nums"
                        value={hunt.army[index] ?? 0}
                        onCommit={(count) => onEdit(i, { unit: unit.key, count: count ?? 0 })}
                        rules={AMOUNT}
                      />
                    ) : (
                      formatAmount(hunt.army[index] ?? 0)
                    )}
                  </TableCell>
                );
              })}
              {columns.difficulty && <TableCell className={NUMBER}>{formatAmount(hunt.difficulty)}</TableCell>}
              {columns.ratio && (
                <TableCell className={NUMBER}>{formatDecimal(hunt.attack / hunt.difficulty, 2)}</TableCell>
              )}
              {columns.meanLosses && (
                <TableCell className={NUMBER}>{formatLosses(hunt.outcome.lostUnits.mean)}</TableCell>
              )}
              {columns.maxLosses && (
                <TableCell className={NUMBER}>{formatAmount(hunt.outcome.lostUnits.max)}</TableCell>
              )}
              {columns.returns && (
                <TableCell className={NUMBER}>
                  {formatEndTimeShort(new Date(now.getTime() + hunt.durationSeconds * 1000), now)}
                </TableCell>
              )}
            </TableRow>
          );
        })}
      </TableBody>
      {plan.hunts.length > 1 && (
        <TableFooter>
          <TableRow>
            <TableHead scope="row">Total</TableHead>
            <TableCell className={NUMBER}>{formatAmount(plan.totalAmount)}</TableCell>
            {units.map((unit) => (
              <TableCell key={unit.key} className={NUMBER}>
                {formatAmount(sent[UNITS.indexOf(unit)] ?? 0)}
              </TableCell>
            ))}
            {columns.difficulty && (
              <TableCell className={NUMBER}>{formatAmount(sum((hunt) => hunt.difficulty))}</TableCell>
            )}
            {columns.ratio && (
              <TableCell className={NUMBER}>
                {formatDecimal(sum((hunt) => hunt.attack) / sum((hunt) => hunt.difficulty), 2)}
              </TableCell>
            )}
            {columns.meanLosses && (
              <TableCell className={NUMBER}>{formatLosses(sum((hunt) => hunt.outcome.lostUnits.mean))}</TableCell>
            )}
            {columns.maxLosses && (
              <TableCell className={NUMBER}>{formatAmount(sum((hunt) => hunt.outcome.lostUnits.max))}</TableCell>
            )}
            {columns.returns && (
              <TableCell className={NUMBER}>
                {formatEndTimeShort(new Date(now.getTime() + plan.durationSeconds * 1000), now)}
              </TableCell>
            )}
          </TableRow>
        </TableFooter>
      )}
    </Table>
  );
}
