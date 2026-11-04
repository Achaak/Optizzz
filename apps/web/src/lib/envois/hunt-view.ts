// The « Chasses » tab's choice, kept in the address so that a link opens it the same (docs/features/site-envois.md,
// « Chasses par membre »): `?onglet=chasses&vue=liste&periode=24h&membre=Noctis`. What it does not know is left at
// its default.
import { HUNT_PERIODS, type HuntPeriod } from "./hunt-stats";

export interface HuntView {
  view: "stats" | "list";
  period: HuntPeriod;
  /** A member's pseudo, as the space writes it. */
  member: string | null;
}

export const DEFAULT_HUNT_VIEW: HuntView = { view: "stats", period: "7j", member: null };

/** The value of `onglet` that opens the « Chasses » tab. */
export const HUNTS_TAB = "chasses";

export function readHuntView(params: { get: (name: string) => string | null }, members: readonly string[]): HuntView {
  const wanted = params.get("membre")?.toLowerCase();
  return {
    view: params.get("vue") === "liste" ? "list" : "stats",
    period: HUNT_PERIODS.find((period) => period === params.get("periode")) ?? DEFAULT_HUNT_VIEW.period,
    member: members.find((m) => m.toLowerCase() === wanted) ?? null,
  };
}

export function huntViewSearch(view: HuntView): string {
  const params = new URLSearchParams({ onglet: HUNTS_TAB });
  if (view.view === "list") params.set("vue", "liste");
  if (view.period !== DEFAULT_HUNT_VIEW.period) params.set("periode", view.period);
  if (view.member !== null) params.set("membre", view.member);
  return params.toString();
}
