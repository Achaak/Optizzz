"use client";

// The hunts, one row each with the totals under them; in the advanced display, more columns can be shown and the hunts
// changed by hand (« Modifier les chasses »). No launch here: the site never acts in the game. See
// docs/features/site-chasse.md.
import { unitLabel, UNITS } from "@optizzz/game/army/units";
import { formatAmount, formatDecimal, formatNumber } from "@optizzz/game/format/number-format";
import { formatEndTimeShort } from "@optizzz/game/format/time-format";
import type { Plan } from "@optizzz/game/hunt/planner";
import { formatLosses } from "@optizzz/game/hunt/texts";
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

export function HuntTable({
  plan,
  unitKeys,
  columns,
  now,
  onEdit,
}: {
  plan: Plan;
  /** Units of the army sent. */
  unitKeys: string[];
  columns: Record<ColumnKey, boolean>;
  now: Date;
  onEdit: (hunt: number, edit: HuntEdit) => void;
}) {
  const sent = UNITS.map((_, i) => plan.hunts.reduce((sum, hunt) => sum + (hunt.army[i] ?? 0), 0));
  const units = UNITS.filter(
    (unit, i) => unitKeys.includes(unit.key) && (columns.emptyUnits || columns.edit || (sent[i] ?? 0) > 0),
  );
  const sum = (pick: (hunt: Plan["hunts"][number]) => number) => plan.hunts.reduce((s, hunt) => s + pick(hunt), 0);
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>N°</TableHead>
          <TableHead className="text-right">Surface</TableHead>
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
        {plan.hunts.map((hunt, i) => (
          <TableRow key={i}>
            <TableHead scope="row">{i + 1}</TableHead>
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
                `${formatNumber(hunt.amount)} cm²`
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
            {columns.maxLosses && <TableCell className={NUMBER}>{formatAmount(hunt.outcome.lostUnits.max)}</TableCell>}
            {columns.returns && (
              <TableCell className={NUMBER}>
                {formatEndTimeShort(new Date(now.getTime() + hunt.durationSeconds * 1000), now)}
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
      {plan.hunts.length > 1 && (
        <TableFooter>
          <TableRow>
            <TableHead scope="row" title="Total">
              T
            </TableHead>
            <TableCell className={NUMBER}>{formatAmount(plan.totalAmount)} cm²</TableCell>
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
