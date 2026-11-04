// The « Jours » view of the « Convois » tab (docs/features/site-envois.md, « La vue « Jours » »): each member day by
// day, one measure at a time for the alliance, every measure for a member chosen. Read from the Équilibre's days
// (`balanceOf`): nothing is worked out twice.
import { formatCompact, formatNumber } from "@optizzz/game/format/number-format";
import type { Balance, BalanceDay, BalanceRow } from "./balance";
import { DAYS_BY_DAY, periodTitle, type DiscordPeriod } from "./convoy-stats";

/** The measures of a day, in the order shown. */
export const DAY_MEASURES = ["field", "production", "afterColonies", "sent", "received"] as const;
export type DayMeasure = (typeof DAY_MEASURES)[number];

/** Each measure in words. */
export const MEASURE_LABELS: Record<DayMeasure, string> = {
  field: "TDC",
  production: "Production",
  afterColonies: "Après colonies",
  sent: "Envoyés",
  received: "Reçus",
};

/** A column: a day, or a week beyond 31 days. */
export interface DayColumn {
  start: number;
  /** « 26/10 »: its first day. */
  label: string;
  /** How many days it counts, today as far as it went. */
  days: number;
  /** It holds today, counted so far. */
  today: boolean;
}

export interface DayTableRow {
  /** A member's pseudo, « Alliance », or a measure's words for a member chosen. */
  label: string;
  measure: DayMeasure;
  /** Each column; null when not in the alliance then. */
  cells: (number | null)[];
  /** The convoys delivered in each column, for « Envoyés » only. */
  counts: (number | null)[] | null;
  /** Null for the TDC, which does not add up, or never in the alliance. */
  total: number | null;
  /** A day of presence on average: the TDC's average, the others' total over those days. */
  average: number | null;
  /** Their convoys are not all known (« Envoyés » and « Reçus »). */
  partial: boolean;
  /** How many days of the period they were in the alliance, today as one. */
  presentDays: number;
}

export interface DayTable {
  columns: DayColumn[];
  alliance: DayTableRow;
  /** In the Équilibre's order, by gap. */
  rows: DayTableRow[];
}

const valueOf = (day: BalanceDay, measure: DayMeasure): number => {
  switch (measure) {
    case "field":
      return day.field ?? 0;
    case "production":
      return day.production;
    case "afterColonies":
      return day.production + day.taxes;
    case "sent":
      return day.sent;
    case "received":
      return day.received;
  }
};

const convoyMeasure = (measure: DayMeasure) => measure === "sent" || measure === "received";

/** The days of the period, by column: one each up to 31 days, 7 each beyond. */
function groupsOf(days: readonly BalanceDay[]): BalanceDay[][] {
  const size = days.length > DAYS_BY_DAY ? 7 : 1;
  const groups: BalanceDay[][] = [];
  for (let i = 0; i < days.length; i += size) groups.push(days.slice(i, i + size));
  return groups;
}

/** A row over the columns from its days: a day without a value is a day out of the alliance. */
function rowOf(
  label: string,
  measure: DayMeasure,
  groups: readonly (readonly { day: BalanceDay; values: number[]; counts: number[] }[])[],
  partial: boolean,
): DayTableRow {
  const field = measure === "field";
  let total = 0;
  let weight = 0;
  let fieldSum = 0;
  let fieldDays = 0;
  let presentDays = 0;
  const cells = groups.map((group) => {
    const present = group.filter((g) => g.values.length > 0);
    if (present.length === 0) return null;
    presentDays += present.length;
    const sum = present.reduce((s, g) => s + g.values.reduce((a, b) => a + b, 0), 0);
    total += sum;
    weight += present.reduce((s, g) => s + g.day.weight, 0);
    if (!field) return sum;
    fieldSum += sum;
    fieldDays += present.length;
    return sum / present.length;
  });
  const counts =
    measure === "sent"
      ? groups.map((group) => {
          const present = group.filter((g) => g.values.length > 0);
          return present.length === 0 ? null : present.reduce((s, g) => s + g.counts.reduce((a, b) => a + b, 0), 0);
        })
      : null;
  return {
    label,
    measure,
    cells,
    counts,
    total: field || weight === 0 ? null : total,
    average: field ? (fieldDays > 0 ? fieldSum / fieldDays : null) : weight > 0 ? total / weight : null,
    partial,
    presentDays,
  };
}

/** A member's row: their own days, present or not. */
function memberRow(row: BalanceRow, measure: DayMeasure, label = row.pseudo): DayTableRow {
  const groups = groupsOf(row.daily).map((group) =>
    group.map((day) => ({
      day,
      values: day.present ? [valueOf(day, measure)] : [],
      counts: day.present ? [day.sentCount] : [],
    })),
  );
  return rowOf(label, measure, groups, row.partial && convoyMeasure(measure));
}

function columnsOf(days: readonly BalanceDay[]): DayColumn[] {
  return groupsOf(days).map((group) => ({
    start: group[0]?.start ?? 0,
    label: group[0]?.label ?? "",
    days: group.reduce((s, d) => s + d.weight, 0),
    today: group.some((d) => d.weight < 1),
  }));
}

/** The alliance's table for one measure: a row per member, the alliance's added up on top. */
export function dayTableOf(balance: Balance, measure: DayMeasure): DayTable {
  const days = balance.rows[0]?.daily ?? [];
  const columns = columnsOf(days);
  // The alliance on each day: the members present, added up; its average over the whole period.
  const groups = groupsOf(days).map((group) =>
    group.map((day) => {
      const index = days.indexOf(day);
      const present = balance.rows.map((r) => r.daily[index]).filter((d): d is BalanceDay => d?.present === true);
      return {
        day,
        values: present.length === 0 ? [] : [present.reduce((s, d) => s + valueOf(d, measure), 0)],
        counts: [present.reduce((s, d) => s + d.sentCount, 0)],
      };
    }),
  );
  const alliance = rowOf("Alliance", measure, groups, convoyMeasure(measure) && balance.coverage.missing.length > 0);
  return { columns, alliance, rows: balance.rows.map((row) => memberRow(row, measure)) };
}

/** A member's every measure, one per line; null when not a member. */
export function memberDaysOf(balance: Balance, pseudo: string): { columns: DayColumn[]; rows: DayTableRow[] } | null {
  const row = balance.rows.find((r) => r.pseudo.toLowerCase() === pseudo.toLowerCase());
  if (!row) return null;
  return {
    columns: columnsOf(row.daily),
    rows: DAY_MEASURES.map((measure) => memberRow(row, measure, MEASURE_LABELS[measure])),
  };
}

export interface DaySort {
  /** The name, the total, the average or a column's index. */
  by: "label" | "total" | "average" | number;
  descending: boolean;
}

/** The rows sorted by a column, those without a value there last. */
export function sortDayRows(rows: readonly DayTableRow[], sort: DaySort): DayTableRow[] {
  if (sort.by === "label") {
    const sorted = [...rows].sort((a, b) => a.label.localeCompare(b.label));
    return sort.descending ? sorted.reverse() : sorted;
  }
  const by = sort.by;
  const pick = (row: DayTableRow) =>
    by === "total" ? row.total : by === "average" ? row.average : (row.cells[by] ?? null);
  return [...rows].sort((a, b) => {
    const x = pick(a);
    const y = pick(b);
    if (x === null || y === null) return Number(x === null) - Number(y === null);
    return sort.descending ? y - x : x - y;
  });
}

/** « 1,2M/j (8,4M sur 7 jours) », « 31 200 en moyenne » for the TDC. */
function lineOf(row: DayTableRow, withDays: boolean): string {
  if (row.measure === "field") return `${formatNumber(row.average ?? 0)} en moyenne`;
  const days = row.presentDays;
  const over = withDays ? ` sur ${String(days)} jour${days > 1 ? "s" : ""}` : "";
  const partial = row.partial ? ", partiel" : "";
  return `${formatCompact(row.average ?? 0)}/j (${formatCompact(row.total ?? 0)}${over}${partial})`;
}

/**
 * The « Jours » view as a message to paste in the alliance's Discord: copied, never sent by Optizzz. The measure
 * chosen a day on average, one line per member present; no table by day, which Discord shows badly.
 */
export function dayTableDiscord(table: DayTable, measure: DayMeasure, context: DiscordPeriod): string {
  const since = table.columns[0]?.start ?? 0;
  return [
    `**${MEASURE_LABELS[measure]} ${context.tag} · ${periodTitle(since, context)}`,
    `Alliance : ${lineOf(table.alliance, false)}`,
    ...table.rows.filter((row) => row.average !== null).map((row) => `- ${row.label} : ${lineOf(row, true)}`),
  ].join("\n");
}
