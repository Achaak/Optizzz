// The Priorité of a requester (GLOSSARY.md, docs/features/site-demandes.md « Priorité »): their Solde over the last
// 30 days divided by their Production, how many days of their own production they already received. The lowest goes
// first. A ranking shown to the validators and the donors, never a decision: nothing is validated or refused by it.
// Worked out by each reader from the alliance's Envois it opened (the site never sees an amount).
import { formatDecimal } from "../format/number-format";
import type { ConvoyItem } from "./envoi-convoys";
import { productionPerDay } from "./envoi-states";

const DAY = 24 * 3600_000;

/** The Solde counts the convoys delivered this long ago at most. */
export const SOLDE_WINDOW_MS = 30 * DAY;

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/**
 * The Solde of GLOSSARY.md: the convoys delivered to `player` less those they delivered, over the last 30 days, food
 * and materials added. Each convoy of `convoys` counts once: pass them as the Convois circuit opened them, one per
 * fingerprint (`newestPerFingerprint`). A convoy on its way is left out: its delivery, read from an inbox, counts
 * instead (the two have different fingerprints, counting both would count it twice).
 */
export function soldeOf(player: string, convoys: readonly ConvoyItem[], now: Date): number {
  const since = now.getTime() - SOLDE_WINDOW_MS;
  let solde = 0;
  for (const convoy of convoys) {
    if (convoy.kind !== "delivered" || convoy.at <= since || convoy.at > now.getTime()) continue;
    if (same(convoy.from, convoy.to)) continue;
    const amount = convoy.food + convoy.materials;
    if (same(convoy.to, player)) solde += amount;
    else if (same(convoy.from, player)) solde -= amount;
  }
  return solde;
}

/** What the Production is worked out from: a member's Production state, as `productionPerDay` reads it. */
export type ProductionInput = Parameters<typeof productionPerDay>[0];

export type Priorite =
  | {
      kind: "known";
      solde: number;
      /** The Production a day, colonies included; a lower bound when `bound` is not « exact ». */
      production: number;
      /** The Solde divided by the Production. */
      days: number;
      /**
       * « exact », or a bound when the Production is only « at least » (a colony taken less than an hour ago,
       * colonies.php not read): more Production makes fewer days, received (« at-most ») or given (« at-least »).
       */
      bound: "exact" | "at-most" | "at-least";
      /** The Production is only « at least » this much (« ≥ » where it is shown). */
      atLeast: boolean;
    }
  /** The Production is nil: no number of days. Ranked as the Solde says (given first, received last). */
  | { kind: "no-production"; solde: number }
  /** Missing the Production (not sent), or the Solde (the player does not send their Convois). */
  | { kind: "unknown"; solde: number | null; production: number | null; missing: ("production" | "convoys")[] };

/**
 * The Priorité of GLOSSARY.md for `player`. `convoys` is null when the player does not send their Convois: their Solde
 * would then be only what the others report, so it is not told. `production` is null without a Production state.
 */
export function prioriteOf(input: {
  player: string;
  convoys: readonly ConvoyItem[] | null;
  production: ProductionInput | null;
  now: Date;
}): Priorite {
  const solde = input.convoys ? soldeOf(input.player, input.convoys, input.now) : null;
  const perDay = input.production ? productionPerDay(input.production, input.now) : null;
  const missing: ("production" | "convoys")[] = [];
  // Nil as far as one knows, the colonies unknown: they may be all of it.
  if (!perDay || (perDay.total <= 0 && !perDay.coloniesKnown)) missing.push("production");
  if (solde === null) missing.push("convoys");
  if (missing.length > 0 || solde === null || !perDay)
    return { kind: "unknown", solde, production: perDay?.total ?? null, missing };
  if (perDay.total <= 0) return { kind: "no-production", solde };
  const bound = perDay.coloniesKnown || solde === 0 ? "exact" : solde > 0 ? "at-most" : "at-least";
  // A partial Production is still ranked, by its bound: colonies.php is read again within 15 minutes of play, and a
  // colony taken less than an hour ago weighs little; leaving the requester out would weigh more.
  const atLeast = !perDay.coloniesKnown;
  return { kind: "known", solde, production: perDay.total, days: solde / perDay.total, bound, atLeast };
}

/**
 * Where a Priorité stands: its days (a bound by its bound); a nil Production as the limit of a Production going to
 * zero (before every known one when it gave, after when it received, with 0 when its Solde is nil); unknown last.
 */
function standing(priorite: Priorite): { known: boolean; days: number } {
  switch (priorite.kind) {
    case "known":
      return { known: true, days: priorite.days };
    case "no-production":
      return { known: true, days: Math.sign(priorite.solde) * Infinity || 0 };
    default:
      return { known: false, days: 0 };
  }
}

/** For `sort`: the lowest Priorité first, the unknown last. Equal ones tie (0), for the caller's own order to decide. */
export function comparePriorites(a: Priorite, b: Priorite): number {
  const x = standing(a);
  const y = standing(b);
  if (x.known !== y.known) return x.known ? -1 : 1;
  if (x.days === y.days) return 0;
  return x.days < y.days ? -1 : 1;
}

/** « 18,4 jours », « 1 jour », « ≤ 2 jours » (a bound), « Production nulle », « Priorité inconnue ». */
export function prioriteText(priorite: Priorite): string {
  if (priorite.kind === "no-production") return "Production nulle";
  if (priorite.kind === "unknown") return "Priorité inconnue";
  const days = formatDecimal(priorite.days);
  const unit = Math.abs(priorite.days) < 2 ? "jour" : "jours";
  const sign = { exact: "", "at-most": "≤ ", "at-least": "≥ " }[priorite.bound];
  return `${sign}${days} ${unit}`;
}
