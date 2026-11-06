// The page « Déclarer » of an Espace d'alliance (ADR 0010, docs/features/site-declarer.md): what a member launched
// without the extension (from their phone), declared by hand and sealed in their browser with the Clé d'alliance, as an
// Envoi of their Joueur. Three kinds, each its own category of Envoi, which no setting sends: a flood, a convoy without
// a Demande (a convoy for a Demande stays `declared-convoys`, demandes.ts) and a hunt. The readers show them marked
// « déclaré », and hide one that an Envoi of the same member's extension covers: the extension wins.
import { z } from "zod";
import { parseGameDuration } from "../pages/work-queue";
import { fromParisParts, parisParts } from "../format/time-format";

const DAY = 24 * 3600_000;

export const DECLARED_FLOOD_CATEGORY = "declared-floods" as const;
export const DECLARED_TRANSIT_CATEGORY = "declared-transits" as const;
export const DECLARED_HUNT_CATEGORY = "declared-hunts" as const;

/** How long the site keeps a declaration: 90 days after its arrival or return, as the other declared convoys. */
export const DECLARATIONS_KEPT_MS = 90 * DAY;

/** How far apart a declaration and an Envoi of the extension may arrive and still be the same thing. */
export const COVERED_WITHIN_MS = 2 * 60_000;

/** The most attacks one flood declaration holds. */
export const MAX_DECLARED_ATTACKS = 200;

const pseudo = z.string().trim().min(1).max(40);
const amount = z.number().int().nonnegative().max(1e15);
const instant = z.number().int().nonnegative();

/** A flood: its target, how many attacks, their arrival. The sender is the Joueur whose Envoi it is. */
export const DECLARED_FLOOD_ITEM = z.object({
  target: pseudo,
  attacks: z.number().int().min(1).max(MAX_DECLARED_ATTACKS),
  at: instant,
});
export type DeclaredFloodItem = z.infer<typeof DECLARED_FLOOD_ITEM>;

/** A convoy for no Demande: its recipient, what it carries, its arrival. */
export const DECLARED_TRANSIT_ITEM = z.object({ to: pseudo, food: amount, materials: amount, at: instant });
export type DeclaredTransitItem = z.infer<typeof DECLARED_TRANSIT_ITEM>;

/** A hunt: the cm² it brings back, its return. */
export const DECLARED_HUNT_ITEM = z.object({ fieldGain: amount, returnsAt: instant });
export type DeclaredHuntItem = z.infer<typeof DECLARED_HUNT_ITEM>;

/** The declarations as a reader holds them, with their sender. */
export type DeclaredFlood = DeclaredFloodItem & { from: string };
export type DeclaredTransit = DeclaredTransitItem & { from: string };
export type DeclaredHunt = DeclaredHuntItem & { hunter: string };

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const near = (a: number, b: number) => Math.abs(a - b) <= COVERED_WITHIN_MS;

/**
 * When the member says it arrives: « À » a Paris time of day (« 18h12 », « 18:12 », « 18h »), today when still to
 * come, otherwise tomorrow; « Dans » the time left as the game writes it (« 2h30m », « 45m »). Null otherwise.
 */
export function parseWhen(mode: "at" | "in", text: string, now: Date): Date | null {
  if (mode === "in") {
    const ms = parseGameDuration(text);
    return ms === null || ms <= 0 ? null : new Date(now.getTime() + ms);
  }
  const match = /^\s*(\d{1,2})\s*(?:[h:]\s*(\d{2})?)\s*$/i.exec(text);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2] ?? "0");
  if (hours > 23 || minutes > 59) return null;
  const today = parisParts(now);
  const when = fromParisParts({ year: today.year, month: today.month, day: today.day, hours, minutes });
  if (when.getTime() > now.getTime()) return when;
  return fromParisParts({ year: today.year, month: today.month, day: today.day + 1, hours, minutes });
}

/** Whether the sender's extension sends at least as many attacks on that target, arriving within 2 minutes. */
export function floodCovered(
  declared: DeclaredFlood,
  floods: readonly { from: string; target: string; at: number }[],
): boolean {
  const matching = floods.filter(
    (f) => same(f.from, declared.from) && same(f.target, declared.target) && near(f.at, declared.at),
  );
  return matching.length >= declared.attacks;
}

/** Whether a convoy of the extension (on its way or delivered) is the same one: sender, recipient, amounts, arrival. */
export function transitCovered(
  declared: DeclaredTransit,
  convoys: readonly { from: string; to: string; food: number; materials: number; at: number }[],
): boolean {
  return convoys.some(
    (c) =>
      same(c.from, declared.from) &&
      same(c.to, declared.to) &&
      c.food === declared.food &&
      c.materials === declared.materials &&
      near(c.at, declared.at),
  );
}

/** Whether the hunter's log holds the same hunt: same cm², back within 2 minutes. */
export function huntCovered(
  declared: DeclaredHunt,
  hunts: readonly { hunter: string; fieldGain: number; returnsAt: number }[],
): boolean {
  return hunts.some(
    (h) =>
      same(h.hunter, declared.hunter) && h.fieldGain === declared.fieldGain && near(h.returnsAt, declared.returnsAt),
  );
}
