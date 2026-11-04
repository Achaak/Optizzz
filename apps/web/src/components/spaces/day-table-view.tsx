"use client";

// The « Jours » view of the Convois tab (docs/features/site-envois.md, « La vue « Jours » »): each member day by day,
// one measure at a time, the alliance on top; with a member chosen, their every measure. Only numbers: a day out of
// the alliance is « — », a partial figure says « partiel » in words (ADR 0003). Worked out in this browser.
import { formatCompact, formatNumber } from "@optizzz/game/format/number-format";
import { cn } from "cn";
import { useState } from "react";
import { Segmented } from "~/components/tools/hunt/hunt-parts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import type { Balance } from "~/lib/envois/balance";
import {
  DAY_MEASURES,
  dayTableOf,
  MEASURE_LABELS,
  memberDaysOf,
  sortDayRows,
  type DayColumn,
  type DayMeasure,
  type DaySort,
  type DayTableRow,
} from "~/lib/envois/day-table";
import { FIELD_LABEL, Panel } from "./parts";

const MEASURE_OPTIONS = DAY_MEASURES.map((value) => ({ value, label: MEASURE_LABELS[value] }));

/** The column of names, kept at the left while the days scroll. */
const STICKY = "sticky left-0 z-10 bg-card";

/** What each measure counts, under the table. */
const MEASURE_NOTES: Record<DayMeasure, string> = {
  field: "TDC : celui de l'export de la nuit, chaque jour ; la ligne Alliance additionne ceux des membres présents.",
  production: "Production : le TDC de l'export de la nuit × 48, aujourd'hui jusqu'à maintenant.",
  afterColonies:
    "Après colonies : production − taxe de colonie versée + taxes reçues ; « ≈ » : un taux supposé à 20 %.",
  sent: "Envoyés : ce que le membre a livré ce jour-là, nourriture et matériaux, le nombre de convois dessous.",
  received: "Reçus : ce qui a été livré au membre ce jour-là, nourriture et matériaux.",
};

/** The TDC whole over a week at most, short beyond; the rest short as the game writes it. */
function valueText(value: number, measure: DayMeasure, whole: boolean) {
  return measure === "field" && whole ? formatNumber(value) : formatCompact(value);
}

function SortButton({
  label,
  by,
  sort,
  onSort,
}: {
  label: React.ReactNode;
  by: DaySort["by"];
  sort: DaySort | null;
  onSort: (sort: DaySort | null) => void;
}) {
  const active = sort?.by === by;
  // Most first (names from A), then the other way, then the Équilibre's order again.
  const first = by !== "label";
  const next = !active ? { by, descending: first } : sort.descending === first ? { by, descending: !first } : null;
  return (
    <button
      type="button"
      onClick={() => onSort(next)}
      className={cn(
        "inline-flex items-center gap-1 hover:text-foreground",
        active ? "text-primary" : "text-muted-foreground",
      )}
    >
      {label}
      {active && <span aria-hidden>{sort.descending ? "▼" : "▲"}</span>}
    </button>
  );
}

function Row({
  row,
  whole,
  alliance = false,
  note,
}: {
  row: DayTableRow;
  whole: boolean;
  alliance?: boolean;
  note?: string;
}) {
  const text = (value: number | null) => (value === null ? "—" : valueText(value, row.measure, whole));
  // A day without a convoy is quieter than one with: its « 0 » is muted.
  const convoys = row.measure === "sent" || row.measure === "received";
  return (
    <TableRow className={cn(alliance && "bg-muted/60 hover:bg-muted/60", row.partial && alliance && "italic")}>
      <TableCell className={cn(STICKY, "pl-4 font-semibold whitespace-nowrap", alliance && "bg-muted")}>
        {row.label}
        {note && <span className="ml-1 font-normal text-muted-foreground">{note}</span>}
        {row.partial && <span className="ml-1.5 text-xs font-normal text-muted-foreground">partiel</span>}
      </TableCell>
      <TableCell className="text-right font-mono text-xs font-semibold">
        {row.total === null ? "—" : text(row.total)}
      </TableCell>
      <TableCell className="border-r text-right font-mono text-xs">
        {row.average === null ? "—" : `${text(row.average)}${row.measure === "field" ? "" : "/j"}`}
      </TableCell>
      {row.cells.map((cell, i) => (
        <TableCell
          key={i}
          className={cn("text-right align-top font-mono text-xs", cell === 0 && convoys && "text-muted-foreground")}
        >
          {text(cell)}
          {row.counts?.[i] ? (
            <span className="block font-sans text-[0.6875rem] text-muted-foreground">
              {formatNumber(row.counts[i] ?? 0)} conv.
            </span>
          ) : null}
        </TableCell>
      ))}
    </TableRow>
  );
}

function Head({
  columns,
  first,
  sort,
  onSort,
}: {
  columns: readonly DayColumn[];
  first: string;
  sort?: DaySort | null;
  onSort?: (sort: DaySort | null) => void;
}) {
  const label = (text: React.ReactNode, by: DaySort["by"]) =>
    onSort && sort !== undefined ? <SortButton label={text} by={by} sort={sort} onSort={onSort} /> : text;
  const weekly = columns.some((column) => column.days > 1);
  const ariaSort = (by: DaySort["by"]) =>
    sort?.by === by ? (sort.descending ? "descending" : "ascending") : undefined;
  return (
    <TableHeader>
      <TableRow>
        <TableHead className={cn(STICKY, "pl-4")} aria-sort={ariaSort("label")}>
          {label(first, "label")}
        </TableHead>
        <TableHead className="text-right" aria-sort={ariaSort("total")}>
          {label("Total", "total")}
        </TableHead>
        <TableHead className="border-r text-right" aria-sort={ariaSort("average")}>
          {label("Moy. / jour", "average")}
        </TableHead>
        {columns.map((column, i) => (
          <TableHead key={column.start} className="text-right" aria-sort={ariaSort(i)}>
            {label(
              <>
                {weekly && "sem. "}
                {column.label}
                {column.today && <span className="font-normal"> · auj.</span>}
              </>,
              i,
            )}
          </TableHead>
        ))}
      </TableRow>
    </TableHeader>
  );
}

export function DayTableView({
  balance,
  days,
  measure,
  member,
  onMeasure,
}: {
  balance: Balance;
  /** How many days in the period. */
  days: number;
  measure: DayMeasure;
  member: string | null;
  onMeasure: (measure: DayMeasure) => void;
}) {
  const [sort, setSort] = useState<DaySort | null>(null);
  const whole = days <= 7;
  const estimated = new Set(balance.rows.filter((r) => r.taxes.estimated).map((r) => r.pseudo));
  const mine = member === null ? null : memberDaysOf(balance, member);

  if (mine && member !== null) {
    const row = balance.rows.find((r) => r.pseudo.toLowerCase() === member.toLowerCase());
    return (
      <Panel title={`${row?.pseudo ?? member} jour par jour`} aside="ses cinq mesures" flush>
        <div className="overflow-x-auto">
          <Table>
            <Head columns={mine.columns} first="Mesure" />
            <TableBody>
              {mine.rows.map((r) => (
                <Row
                  key={r.measure}
                  row={r}
                  whole={whole}
                  note={r.measure === "afterColonies" && row?.taxes.estimated ? "≈" : undefined}
                />
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="border-t px-4 py-2.5 text-xs text-muted-foreground">
          {MEASURE_NOTES.field} {MEASURE_NOTES.afterColonies} {MEASURE_NOTES.sent} « — » : pas dans l&apos;alliance ce
          jour-là, d&apos;après l&apos;export.
        </p>
      </Panel>
    );
  }

  const table = dayTableOf(balance, measure);
  const rows = sort === null ? table.rows : sortDayRows(table.rows, sort);
  const members = table.rows.filter((r) => r.presentDays > 0).length;
  return (
    <Panel
      title={`Jour par jour · ${MEASURE_LABELS[measure]}`}
      aside={
        sort === null ? "trié par écart (Équilibre) · cliquez un en-tête pour trier" : "cliquez un en-tête pour trier"
      }
      flush
    >
      <div className="space-y-1 px-4 pb-3">
        <span className={FIELD_LABEL}>Mesure</span>
        <Segmented label="Mesure" options={MEASURE_OPTIONS} value={measure} onChange={onMeasure} />
      </div>
      <div className="overflow-x-auto">
        <Table>
          <Head columns={table.columns} first="Membre" sort={sort} onSort={setSort} />
          <TableBody>
            <Row
              row={table.alliance}
              whole={whole}
              alliance
              note={`· ${formatNumber(members)} membre${members > 1 ? "s" : ""}`}
            />
            {rows.map((row) => (
              <Row
                key={row.label}
                row={row}
                whole={whole}
                note={measure === "afterColonies" && estimated.has(row.label) ? "≈" : undefined}
              />
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="border-t px-4 py-2.5 text-xs text-muted-foreground">
        {MEASURE_NOTES[measure]} La moyenne ne compte que les jours où le membre est dans l&apos;alliance. « — » : pas
        dans l&apos;alliance ce jour-là, d&apos;après l&apos;export.
        {table.alliance.partial &&
          " « partiel » : un membre qui n'envoie pas « Convois » ; ce qu'il échange hors de l'Espace manque."}
      </p>
    </Panel>
  );
}
