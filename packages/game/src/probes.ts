// Probes: ants always kept on each watched place (hunting field, dome, lodge), so that an attack there makes a fight
// and its report shows the attacker's army. How many of each unit is the player's choice. See docs/features/sondes.md.
import type { Place } from "./army/battle";
import { emptyArmy, UNITS, type Army } from "./army/units";

export const PLACES: readonly Place[] = ["field", "nest", "lodge"];

/** With its article: « Pas de sonde sur le Dôme ». */
export const PLACE_NAMES: Record<Place, string> = { field: "le Terrain de chasse", nest: "le Dôme", lodge: "la Loge" };

/** « 1 JSN du Dôme ». */
export const PLACE_FROM: Record<Place, string> = {
  field: "du Terrain de chasse",
  nest: "du Dôme",
  lodge: "de la Loge",
};

/** What each watched place keeps, by unit; a place left out is not watched. */
export type ProbePlan = Partial<Record<Place, Army>>;

/** `count` ants of `unit` (index in UNITS) moved from a place to another. */
export interface ProbeMove {
  unit: number;
  count: number;
  from: Place;
  to: Place;
}

const watchedOf = (plan: ProbePlan) => PLACES.filter((place) => plan[place]);

/** The watched places short of their probes. */
export const placesWithoutProbe = (armies: Record<Place, Army>, plan: ProbePlan): Place[] =>
  watchedOf(plan).filter((place) => (plan[place] ?? []).some((wanted, unit) => (armies[place][unit] ?? 0) < wanted));

/** Every probe of the plan together. */
export function probeArmy(plan: ProbePlan): number[] {
  const army = emptyArmy();
  for (const place of watchedOf(plan)) plan[place]?.forEach((count, unit) => (army[unit] = (army[unit] ?? 0) + count));
  return army;
}

/**
 * The moves that bring each watched place up to its probes: ants another place can spare (a watched place keeps its
 * own probes, a place nobody watches can be emptied), taken where there are the most to spare. `missing`: places
 * still short, too few ants of a unit home.
 */
export function probeMoves(armies: Record<Place, Army>, plan: ProbePlan): { moves: ProbeMove[]; missing: Place[] } {
  const left: Record<Place, number[]> = { field: [...armies.field], nest: [...armies.nest], lodge: [...armies.lodge] };
  const spare = (place: Place, unit: number) => (left[place][unit] ?? 0) - (plan[place]?.[unit] ?? 0);
  const moves: ProbeMove[] = [];
  const missing: Place[] = [];
  for (const to of watchedOf(plan)) {
    let short = false;
    for (const [unit, wanted] of (plan[to] ?? []).entries()) {
      let needed = wanted - (left[to][unit] ?? 0);
      const givers = PLACES.filter((from) => from !== to && spare(from, unit) > 0).sort(
        (a, b) => spare(b, unit) - spare(a, unit),
      );
      for (const from of givers) {
        if (needed <= 0) break;
        const count = Math.min(needed, spare(from, unit));
        left[from][unit] = (left[from][unit] ?? 0) - count;
        left[to][unit] = (left[to][unit] ?? 0) + count;
        needed -= count;
        moves.push({ unit, count, from, to });
      }
      if (needed > 0) short = true;
    }
    if (short) missing.push(to);
  }
  return { moves, missing };
}

/**
 * `sent` minus what the plan's probes need to stay home, `home` being every ant home before sending. Where they stay
 * does not matter: they are moved to their places afterwards.
 */
export function keepProbes(sent: Army, home: Army, plan: ProbePlan): number[] {
  const needed = probeArmy(plan);
  return sent.map((count, unit) => {
    const staying = (home[unit] ?? 0) - count;
    return Math.max(0, count - Math.max(0, (needed[unit] ?? 0) - staying));
  });
}

/** Where the army is put away when it comes back: the Loge, the safest place. */
const STORE: Place = "lodge";

/**
 * The moves that put the army away (« Replacer l'armée », after an army comes back): each place other than the Loge
 * keeps exactly its probes, every other ant goes to the Loge. Probes come first when there are too few ants; `missing`:
 * places still short of theirs.
 */
export function storeMoves(armies: Record<Place, Army>, plan: ProbePlan): { moves: ProbeMove[]; missing: Place[] } {
  const moves: ProbeMove[] = [];
  const missing = new Set<Place>();
  for (const unit of UNITS.keys()) {
    let left = PLACES.reduce((sum, place) => sum + (armies[place][unit] ?? 0), 0);
    const wanted = (place: Place) => plan[place]?.[unit] ?? 0;
    const final = { field: 0, nest: 0, lodge: 0 };
    for (const place of PLACES.filter((candidate) => candidate !== STORE)) {
      final[place] = Math.min(wanted(place), left);
      left -= final[place];
    }
    final[STORE] = left;
    for (const place of PLACES) if (final[place] < wanted(place)) missing.add(place);

    const gap = (place: Place) => (armies[place][unit] ?? 0) - final[place];
    const surplus = Object.fromEntries(PLACES.map((place) => [place, gap(place)])) as Record<Place, number>;
    for (const to of PLACES.filter((place) => surplus[place] < 0)) {
      const givers = PLACES.filter((from) => surplus[from] > 0).sort((a, b) => surplus[b] - surplus[a]);
      for (const from of givers) {
        if (surplus[to] >= 0) break;
        const count = Math.min(surplus[from], -surplus[to]);
        surplus[from] -= count;
        surplus[to] += count;
        moves.push({ unit, count, from, to });
      }
    }
  }
  return { moves, missing: PLACES.filter((place) => missing.has(place)) };
}
