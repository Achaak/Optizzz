// The « Convois » tab's choice, kept in the address so that a link opens it the same (docs/features/site-envois.md,
// « Statistiques des convois », « Équilibre des ressources », « Jours et période libre »):
// `?onglet=convois&vue=jours&du=2026-10-12&au=2026-10-20&mesure=envoyes&membre=Noctis`. What it does not know is left
// at its default.
import { PERIODS, type Period } from "./convoy-stats";
import { DAY_MEASURES, type DayMeasure } from "./day-table";
import { readRange, type DayRange } from "./period";

export interface ConvoyView {
  view: "stats" | "balance" | "days" | "list";
  days: Period;
  /** A free period, over `days` when set. */
  range: DayRange | null;
  /** What the « Jours » view shows for the whole alliance. */
  measure: DayMeasure;
  /** A member's pseudo, as the space writes it. */
  member: string | null;
}

export const DEFAULT_CONVOY_VIEW: ConvoyView = {
  view: "stats",
  days: 30,
  range: null,
  measure: "production",
  member: null,
};

/** Each view as the address writes it. */
const VIEW_NAMES = { list: "liste", balance: "equilibre", days: "jours" } as const;
const VIEW_OF: Record<string, ConvoyView["view"]> = { liste: "list", equilibre: "balance", jours: "days" };

/** Each measure as the address writes it. */
const MEASURE_NAMES: Record<DayMeasure, string> = {
  field: "tdc",
  production: "production",
  afterColonies: "apres-colonies",
  sent: "envoyes",
  received: "recus",
};

/** The value of `onglet` that opens the « Convois » tab. */
export const CONVOYS_TAB = "convois";

export function readConvoyView(
  params: { get: (name: string) => string | null },
  members: readonly string[],
): ConvoyView {
  const days = PERIODS.find((period) => String(period) === params.get("periode"));
  const wanted = params.get("membre")?.toLowerCase();
  return {
    view: VIEW_OF[params.get("vue") ?? ""] ?? "stats",
    days: days ?? DEFAULT_CONVOY_VIEW.days,
    range: readRange(params),
    measure: DAY_MEASURES.find((m) => MEASURE_NAMES[m] === params.get("mesure")) ?? DEFAULT_CONVOY_VIEW.measure,
    member: members.find((m) => m.toLowerCase() === wanted) ?? null,
  };
}

export function convoyViewSearch(view: ConvoyView): string {
  const params = new URLSearchParams({ onglet: CONVOYS_TAB });
  if (view.view !== "stats") params.set("vue", VIEW_NAMES[view.view]);
  if (view.range) {
    params.set("du", view.range.from);
    params.set("au", view.range.to);
  } else if (view.days !== DEFAULT_CONVOY_VIEW.days) params.set("periode", String(view.days));
  if (view.measure !== DEFAULT_CONVOY_VIEW.measure) params.set("mesure", MEASURE_NAMES[view.measure]);
  if (view.member !== null) params.set("membre", view.member);
  return params.toString();
}
