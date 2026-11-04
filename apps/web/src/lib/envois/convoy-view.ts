// The « Convois » tab's choice, kept in the address so that a link opens it the same (docs/features/site-envois.md,
// « Statistiques des convois », « Équilibre des ressources »): `?onglet=convois&vue=liste&periode=7&membre=Noctis`.
// What it does not know is left at its default.
import { PERIODS, type Period } from "./convoy-stats";

export interface ConvoyView {
  view: "stats" | "balance" | "list";
  days: Period;
  /** A member's pseudo, as the space writes it. */
  member: string | null;
}

export const DEFAULT_CONVOY_VIEW: ConvoyView = { view: "stats", days: 30, member: null };

/** Each view as the address writes it. */
const VIEW_NAMES = { list: "liste", balance: "equilibre" } as const;
const VIEW_OF: Record<string, ConvoyView["view"]> = { liste: "list", equilibre: "balance" };

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
    member: members.find((m) => m.toLowerCase() === wanted) ?? null,
  };
}

export function convoyViewSearch(view: ConvoyView): string {
  const params = new URLSearchParams({ onglet: CONVOYS_TAB });
  if (view.view !== "stats") params.set("vue", VIEW_NAMES[view.view]);
  if (view.days !== DEFAULT_CONVOY_VIEW.days) params.set("periode", String(view.days));
  if (view.member !== null) params.set("membre", view.member);
  return params.toString();
}
