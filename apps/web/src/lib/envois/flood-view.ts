// The « Floods » tab's choice, kept in the address so that a link opens it the same (docs/features/site-envois.md,
// « Statistiques des floods », « La période libre »): `?onglet=floods&vue=liste&periode=24h&membre=Noctis`,
// `?onglet=floods&du=2026-10-30&au=2026-11-01`. What it does not know is left at its default.
import { FLOOD_PERIODS, type FloodPeriod } from "./flood-stats";
import { readRange, type DayRange } from "./period";

export interface FloodView {
  view: "stats" | "list";
  period: FloodPeriod;
  /** A free period, over `period` when set. */
  range: DayRange | null;
  /** A member's pseudo, as the space writes it. */
  member: string | null;
}

export const DEFAULT_FLOOD_VIEW: FloodView = { view: "stats", period: "7j", range: null, member: null };

/** The value of `onglet` that opens the « Floods » tab. */
export const FLOODS_TAB = "floods";

export function readFloodView(params: { get: (name: string) => string | null }, members: readonly string[]): FloodView {
  const wanted = params.get("membre")?.toLowerCase();
  return {
    view: params.get("vue") === "liste" ? "list" : "stats",
    period: FLOOD_PERIODS.find((period) => period === params.get("periode")) ?? DEFAULT_FLOOD_VIEW.period,
    range: readRange(params),
    member: members.find((m) => m.toLowerCase() === wanted) ?? null,
  };
}

export function floodViewSearch(view: FloodView): string {
  const params = new URLSearchParams({ onglet: FLOODS_TAB });
  if (view.view === "list") params.set("vue", "liste");
  if (view.range) {
    params.set("du", view.range.from);
    params.set("au", view.range.to);
  } else if (view.period !== DEFAULT_FLOOD_VIEW.period) params.set("periode", view.period);
  if (view.member !== null) params.set("membre", view.member);
  return params.toString();
}
