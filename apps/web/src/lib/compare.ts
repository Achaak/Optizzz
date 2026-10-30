// The Comparer page (docs/features/site-refonte.md): 2 to 5 players or alliances of a server on one curve, the
// choice kept in the address. Pure, for the tests.
import { formatNumber } from "@optizzz/game/format/number-format";

export const MAX_COMPARED = 5;

export type CompareKind = "players" | "alliances";
export type CompareMetric = "field" | "rank" | "building" | "technology" | "trophy";
export type ComparePeriod = "all" | "30" | "7";

export const COMPARE_KINDS: readonly [CompareKind, ...CompareKind[]] = ["players", "alliances"];
export const COMPARE_PERIODS: readonly [ComparePeriod, ...ComparePeriod[]] = ["all", "30", "7"];
export const COMPARE_METRICS: readonly [CompareMetric, ...CompareMetric[]] = [
  "field",
  "rank",
  "building",
  "technology",
  "trophy",
];

export const METRIC_LABELS: Record<CompareMetric, string> = {
  field: "TDC",
  rank: "Rang",
  building: "Fourmilière",
  technology: "Technologie",
  trophy: "Combat",
};

export const PERIOD_LABELS: Record<ComparePeriod, string> = { all: "Tout", "30": "30 jours", "7": "7 jours" };

/** The players' ids or the alliances' tags of the `ids` parameter: at most five, each once. */
export function idsOf(kind: CompareKind, value: string | string[] | undefined): string[] {
  if (typeof value !== "string") return [];
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const part of value.split(",")) {
    const id = part.trim();
    // A tag is looked up without regard to case (findAlliance): « 4o4 » is « 4O4 ».
    const key = id.toLowerCase();
    if (!id || seen.has(key) || id.length > 20) continue;
    if (kind === "players" && !/^\d+$/.test(id)) continue;
    seen.add(key);
    ids.push(id);
  }
  return ids.slice(0, MAX_COMPARED);
}

export interface CompareState {
  kind: CompareKind;
  ids: string[];
  metric: CompareMetric;
  period: ComparePeriod;
}

/** The page showing `state`, its defaults left out of the address. */
export function compareHref(server: string, state: CompareState): string {
  const params = new URLSearchParams();
  if (state.kind !== "players") params.set("type", state.kind);
  if (state.ids.length > 0) params.set("ids", state.ids.join(","));
  if (state.metric !== "field") params.set("courbe", state.metric);
  if (state.period !== "all") params.set("periode", state.period);
  const search = params.toString();
  return search ? `/${server}/compare?${search}` : `/${server}/compare`;
}

/** The first day the period shows, ending on `last` (the latest nightly reading); null for the whole history. */
export function periodStart(period: ComparePeriod, last: Date): Date | null {
  if (period === "all") return null;
  return new Date(last.getTime() - (Number(period) - 1) * 24 * 3600 * 1000);
}

export interface ComparePoint {
  day: Date;
  value: number;
}

/** One row per day for the chart, oldest first: each series' value that day, null on a day it misses. */
export function mergeSeries(series: { points: ComparePoint[] }[]): { day: Date; values: (number | null)[] }[] {
  const rows = new Map<number, (number | null)[]>();
  series.forEach(({ points }, index) => {
    for (const point of points) {
      const key = point.day.getTime();
      const values = rows.get(key) ?? series.map(() => null);
      values[index] = point.value;
      rows.set(key, values);
    }
  });
  return [...rows.entries()].sort(([a], [b]) => a - b).map(([key, values]) => ({ day: new Date(key), values }));
}

/** From `first` to `last`: « +582 195 », « −50 »; a rank in places won (« ▲ 7 ») or lost (« ▼ 3 »). */
export function deltaText(first: number, last: number, rank: boolean): string {
  if (first === last) return "=";
  if (rank) return `${last < first ? "▲" : "▼"} ${formatNumber(Math.abs(first - last))}`;
  return `${last > first ? "+" : "−"}${formatNumber(Math.abs(last - first))}`;
}
