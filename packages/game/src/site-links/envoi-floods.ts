// The Floods category of the Envois (docs/features/site-envois.md): one encrypted row per attack on its way, as the
// game lists it under « Attaque(s) en cours » on Armee.php, with its target and arrival; for an attack of the Plan de
// flood, also the take expected and, in a second encrypted blob that the site hands to the space's Admins only, the
// army sent. Only the sender sees an attack: its identity is the game's number for it, the same at each reading.
import { z } from "zod";
import { UNITS, unitLabel } from "../army/units";
import { formatNumber } from "../format/number-format";
import { formatEndTime, formatEndTimeShort } from "../format/time-format";

const DAY = 24 * 3600_000;

/** How long the site keeps a flood: until 7 days after its arrival (site-optizzz.md, « Conservation »). */
export const FLOODS_KEPT_MS = 7 * DAY;

export const FLOOD_ITEM = z.object({
  /** The member who sent it. */
  from: z.string().min(1).max(40),
  target: z.string().min(1).max(40),
  /** Milliseconds since 1970: the arrival. */
  at: z.number().int().nonnegative(),
  /** What the Plan de flood expects it to take; null for an attack sent without the plan. */
  take: z.number().int().nonnegative().nullable(),
});

export type FloodItem = z.infer<typeof FLOOD_ITEM>;

/** The army sent, by unit key (« JSN »…): the Admins' blob. */
export const FLOOD_ARMY = z.object({
  army: z.record(z.string().min(1).max(8), z.number().int().nonnegative()),
});

export type FloodArmy = z.infer<typeof FLOOD_ARMY>;

/** One flood to send: its identity (what the fingerprint is drawn from), the item, the army, the site's date. */
export interface FloodEnvoiItem {
  identity: string;
  item: FloodItem;
  /** Null for an attack sent without the Plan de flood: nothing for the Admins. */
  detail: FloodArmy | null;
  expiresAt: number;
}

export interface FloodsKept {
  server: string;
  /** The Joueur whose extension read them: the sender. */
  me: string;
  attacks: readonly {
    /** The game's number for the attack (`span#attaque_<n>`, `Armee.php?annuler=<n>`). */
    attackId: number;
    target: string;
    arrivesAt: Date;
    take: number | null;
    army: Readonly<Record<string, number>> | null;
  }[];
}

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** What the extension kept of a Joueur's attacks on their way, as Envoi items. */
export function floodEnvoiItems(kept: FloodsKept): FloodEnvoiItem[] {
  return kept.attacks.map((attack) => {
    const army = attack.army && Object.fromEntries(Object.entries(attack.army).filter(([, count]) => count > 0));
    return {
      identity: ["flood", kept.server, String(attack.attackId)].join("|"),
      item: { from: kept.me, target: attack.target, at: attack.arrivesAt.getTime(), take: attack.take },
      detail: army && Object.keys(army).length > 0 ? { army } : null,
      expiresAt: attack.arrivesAt.getTime() + FLOODS_KEPT_MS,
    };
  });
}

const byArrival = (a: FloodItem, b: FloodItem) => a.at - b.at;

/** The floods still on their way to `me` from someone else, soonest first. */
export function floodsToward<T extends FloodItem>(me: string, now: Date, floods: readonly T[]): T[] {
  return floods.filter((f) => same(f.target, me) && !same(f.from, me) && f.at > now.getTime()).sort(byArrival);
}

/**
 * The floods still on their way to the other members, by target: the target hit soonest first, each one's floods
 * soonest first.
 */
export function floodsOnMembers<T extends FloodItem>(
  me: string,
  members: readonly string[],
  now: Date,
  floods: readonly T[],
): { target: string; floods: T[] }[] {
  const groups = new Map<string, { target: string; floods: T[] }>();
  for (const f of [...floods].sort(byArrival)) {
    if (f.at <= now.getTime() || same(f.target, me) || !members.some((m) => same(m, f.target))) continue;
    const key = f.target.toLowerCase();
    const group = groups.get(key) ?? { target: f.target, floods: [] };
    group.floods.push(f);
    groups.set(key, group);
  }
  return [...groups.values()];
}

/** « Pseudo, arrivée aujourd'hui 18 h 12, prise attendue 12 348 »: the take only when the Plan de flood knows it. */
export function floodLine(flood: FloodItem, now: Date): string {
  const take = flood.take === null ? "" : `, prise attendue ${formatNumber(flood.take)}`;
  return `${flood.from}, arrivée ${formatEndTime(new Date(flood.at), now)}${take}`;
}

/**
 * « déjà visée par Pseudo, arrivée 18 h 12 », for the Plan de flood and the targets: the other members' floods on
 * their way to `target`. Null when there is none.
 */
export function aimedAt(target: string, me: string, now: Date, floods: readonly FloodItem[]): string | null {
  const on = floods.filter((f) => same(f.target, target) && !same(f.from, me) && f.at > now.getTime()).sort(byArrival);
  const when = (f: FloodItem) => `arrivée ${formatEndTimeShort(new Date(f.at), now)}`;
  const [first] = on;
  if (!first) return null;
  if (on.length === 1) return `déjà visée par ${first.from}, ${when(first)}`;
  const parts = on.map((f) => `${f.from} (${when(f)})`);
  return `déjà visée par ${parts.slice(0, -1).join(", ")} et ${parts.at(-1) ?? ""}`;
}

/** « 1 488 JSN, 485 SN, 2 T », in the game's order of units, abbreviated as the game writes them. */
export function floodArmyText(army: Readonly<Record<string, number>>): string {
  return UNITS.filter((unit) => (army[unit.key] ?? 0) > 0)
    .map((unit) => `${formatNumber(army[unit.key] ?? 0)} ${unitLabel(unit.key)}`)
    .join(", ");
}
