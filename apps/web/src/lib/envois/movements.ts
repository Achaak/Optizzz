// The « Mouvements » tab of a space (docs/features/site-mouvements.md): every arrival of the alliance, hour by hour
// in Paris, for the day chosen. Floods, convoys and hunts coming back, drawn from the Envois the page already opened;
// the repeated ones within an hour folded into one line.
import type { MemberStates } from "@optizzz/game/sharing/shared-state";
import type { ConvoyItem } from "@optizzz/game/site-links/envoi-convoys";
import type { HuntItem } from "@optizzz/game/site-links/envoi-hunts";
import type { FloodItem } from "@optizzz/game/site-links/envoi-floods";
import { fromParisParts, parisParts } from "@optizzz/game/format/time-format";

/** Declared by hand on the page « Déclarer » (declarations.ts), not sent by an extension. */
interface Declared {
  declared?: true;
}

/** What the tab reads: the items of the Envois, and those a member declared. */
type Item<T> = T & Declared;

export type Movement =
  | ({ kind: "flood"; at: number; from: string; to: string; take: number | null } & Declared)
  | ({
      kind: "convoy";
      at: number;
      from: string;
      to: string;
      food: number;
      materials: number;
      /** Arrived on its way, its delivery not read yet by its sender or its recipient. */
      unconfirmed: boolean;
    } & Declared)
  | ({ kind: "hunt"; at: number; from: string; field: number } & Declared);

const declaredOf = (item: Declared): Declared => (item.declared ? { declared: true } : {});

export type MovementKind = Movement["kind"];

/** How far apart the arrival on the way and the delivery of a convoy may be: each side counts from its own clock. */
const MATCH_MS = 5 * 60_000;

const key = (pseudo: string) => pseudo.toLowerCase();

/**
 * A convoy arrived on its way and the same convoy delivered are two Envois: the arrival is left out once a delivery
 * with the same players and loads is read within 5 minutes, each delivery matching the nearest arrival.
 */
function convoyMovements(convoys: readonly Item<ConvoyItem>[], now: number): Movement[] {
  const same = (a: ConvoyItem, b: ConvoyItem) =>
    key(a.from) === key(b.from) && key(a.to) === key(b.to) && a.food === b.food && a.materials === b.materials;
  const arrived = convoys.filter((c) => c.kind === "transit" && c.at <= now);
  const matched = new Set<ConvoyItem>();
  for (const delivery of convoys.filter((c) => c.kind === "delivered")) {
    const nearest = arrived
      .filter((c) => !matched.has(c) && same(c, delivery) && Math.abs(c.at - delivery.at) <= MATCH_MS)
      .sort((a, b) => Math.abs(a.at - delivery.at) - Math.abs(b.at - delivery.at))[0];
    if (nearest) matched.add(nearest);
  }
  return convoys
    .filter((c) => !matched.has(c))
    .map((c) => ({
      kind: "convoy",
      at: c.at,
      from: c.from,
      to: c.to,
      food: c.food,
      materials: c.materials,
      unconfirmed: c.kind === "transit" && c.at <= now,
      ...declaredOf(c),
    }));
}

/** Two readings of a countdown are a few seconds apart: the same hunt within this, with the same gain. */
const SAME_HUNT_MS = 2 * 60_000;

/**
 * The hunts of the hunts log (back ones too), then those of each member's last two states that the log does not have:
 * a hunt still out at the first reading is the same at the second, and the same as the log's.
 */
function huntMovements(states: readonly MemberStates[], log: readonly Item<HuntItem>[]): Movement[] {
  const logged: Movement[] = log.map((h) => ({
    kind: "hunt",
    at: h.returnsAt,
    from: h.hunter,
    field: h.fieldGain,
    ...declaredOf(h),
  }));
  const inLog = (from: string, at: number, field: number) =>
    logged.some(
      (m) => m.kind === "hunt" && key(m.from) === key(from) && m.field === field && Math.abs(m.at - at) <= SAME_HUNT_MS,
    );
  const hunts = new Map<string, Movement>();
  for (const { latest, previous } of states)
    for (const state of [latest, previous])
      for (const hunt of state?.hunts ?? []) {
        const at = hunt.returnsAt.getTime();
        if (inLog(latest.pseudo, at, hunt.fieldGain)) continue;
        hunts.set(`${key(latest.pseudo)}|${String(at)}`, {
          kind: "hunt",
          at,
          from: latest.pseudo,
          field: hunt.fieldGain,
        });
      }
  return [...logged, ...hunts.values()];
}

/**
 * The members whose hunts are known from their states only, not from the hunts log (an extension older than it): for
 * them, hunts already back may be missing.
 */
export function membersWithoutHuntsLog(states: readonly MemberStates[], log: readonly HuntItem[]): string[] {
  const logging = new Set(log.map((h) => key(h.hunter)));
  return states
    .filter(({ latest, previous }) => (latest.hunts?.length ?? 0) + (previous?.hunts?.length ?? 0) > 0)
    .map(({ latest }) => latest.pseudo)
    .filter((pseudo) => !logging.has(key(pseudo)));
}

/** Every movement the space's Envois know, in the order they arrive. */
export function allianceMovements(input: {
  floods: readonly Item<FloodItem>[];
  convoys: readonly Item<ConvoyItem>[];
  states: readonly MemberStates[];
  /** The hunts log; absent, the hunts come from the states only. */
  hunts?: readonly Item<HuntItem>[];
  now: Date;
}): Movement[] {
  const floods: Movement[] = input.floods.map((f) => ({
    kind: "flood",
    at: f.at,
    from: f.from,
    to: f.target,
    take: f.take,
    ...declaredOf(f),
  }));
  return [
    ...floods,
    ...convoyMovements(input.convoys, input.now.getTime()),
    ...huntMovements(input.states, input.hunts ?? []),
  ].sort((a, b) => a.at - b.at);
}

/** How many days back the tab goes: the site keeps a flood 7 days after it arrives. */
const DAYS_BACK = 6;

/** « 2026-11-03 »: the day a Paris calendar shows at `at`. */
export function parisDay(at: number): string {
  const { year, month, day } = parisParts(new Date(at));
  return `${String(year)}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Midnight in Paris at the start of `day`, `shift` days later. */
function parisMidnight(day: string, shift = 0): number {
  const [year = 0, month = 1, date = 1] = day.split("-").map(Number);
  return fromParisParts({ year, month, day: date + shift, hours: 0, minutes: 0 }).getTime();
}

/** The days the tab offers: from 6 days ago to today in Paris, or to the last day something arrives. */
export function movementDays(movements: readonly Movement[], now: Date): string[] {
  const today = parisDay(now.getTime());
  const last = parisDay(Math.max(now.getTime(), ...movements.map((m) => m.at)));
  const days: string[] = [];
  for (let shift = -DAYS_BACK; ; shift++) {
    const day = parisDay(parisMidnight(today, shift));
    days.push(day);
    if (day >= last) return days;
  }
}

export interface MovementFilter {
  /** « 2026-11-03 », a day of Paris. */
  day: string;
  /** A member's pseudo: their movements, sent or received. */
  member: string | null;
  kinds: readonly MovementKind[];
}

/** The same movement repeated within an hour: same kind, same sender, same target. */
export interface MovementGroup {
  kind: MovementKind;
  from: string;
  /** Null for hunts. */
  to: string | null;
  movements: Movement[];
}

export interface MovementHour {
  /** 0 to 23, Paris time. */
  hour: number;
  /** The movements, not the groups. */
  count: number;
  groups: MovementGroup[];
}

/** The day in figures, over the movements shown. */
export interface MovementTiles {
  /** `take`: what the Plan de flood expects; `withoutPlan`: floods sent without it, their take unknown. */
  flood: { count: number; take: number; withoutPlan: number };
  convoy: { count: number; food: number; materials: number };
  /** `field`: hunting field brought back, cm². */
  hunt: { count: number; field: number };
}

export interface DayTimeline {
  hours: MovementHour[];
  tiles: MovementTiles;
}

const targetOf = (m: Movement) => (m.kind === "hunt" ? null : m.to);

/** The day's movements by the hour of Paris they arrive in, the hours without any left out. */
export function dayTimeline(movements: readonly Movement[], filter: MovementFilter): DayTimeline {
  const start = parisMidnight(filter.day);
  const end = parisMidnight(filter.day, 1);
  const member = filter.member === null ? null : key(filter.member);
  const shown = movements
    .filter((m) => m.at >= start && m.at < end && filter.kinds.includes(m.kind))
    .filter((m) => member === null || key(m.from) === member || key(targetOf(m) ?? "") === member)
    .sort((a, b) => a.at - b.at);
  const tiles: MovementTiles = {
    flood: { count: 0, take: 0, withoutPlan: 0 },
    convoy: { count: 0, food: 0, materials: 0 },
    hunt: { count: 0, field: 0 },
  };
  const hours = new Map<number, MovementHour>();
  for (const movement of shown) {
    if (movement.kind === "flood") {
      tiles.flood.count += 1;
      if (movement.take === null) tiles.flood.withoutPlan += 1;
      else tiles.flood.take += movement.take;
    } else if (movement.kind === "convoy") {
      tiles.convoy.count += 1;
      tiles.convoy.food += movement.food;
      tiles.convoy.materials += movement.materials;
    } else {
      tiles.hunt.count += 1;
      tiles.hunt.field += movement.field;
    }
    const hour = parisParts(new Date(movement.at)).hours;
    const row = hours.get(hour) ?? { hour, count: 0, groups: [] };
    hours.set(hour, row);
    row.count += 1;
    const to = targetOf(movement);
    const same = (g: MovementGroup) =>
      g.kind === movement.kind && key(g.from) === key(movement.from) && key(g.to ?? "") === key(to ?? "");
    const group = row.groups.find(same);
    if (group) group.movements.push(movement);
    else row.groups.push({ kind: movement.kind, from: movement.from, to, movements: [movement] });
  }
  return { hours: [...hours.values()], tiles };
}

/** Today, the hours before the one now, folded by default; another day shows them all. */
export function foldPastHours(
  hours: readonly MovementHour[],
  day: string,
  now: Date,
): { past: MovementHour[]; shown: MovementHour[] } {
  if (day !== parisDay(now.getTime())) return { past: [], shown: [...hours] };
  const current = parisParts(now).hours;
  return { past: hours.filter((h) => h.hour < current), shown: hours.filter((h) => h.hour >= current) };
}
