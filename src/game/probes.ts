// Probes: an ant always kept on each place (hunting field, dome, lodge), so that an attack there makes a fight and its
// report shows the attacker's army. See docs/features/sondes.md.
import type { Place } from "./army/battle";
import { UNITS, type Army } from "./army/units";

export const PLACES: readonly Place[] = ["field", "nest", "lodge"];

/** With its article: « Pas de sonde sur le Dôme ». */
export const PLACE_NAMES: Record<Place, string> = { field: "le Terrain de chasse", nest: "le Dôme", lodge: "la Loge" };

/** « 1 JSN du Dôme ». */
export const PLACE_FROM: Record<Place, string> = {
  field: "du Terrain de chasse",
  nest: "du Dôme",
  lodge: "de la Loge",
};

/** One ant moved from a place to another; `unit` is its index in UNITS. */
export interface ProbeMove {
  unit: number;
  from: Place;
  to: Place;
}

const total = (army: Army) => army.reduce((sum, count) => sum + count, 0);

/** Unit indexes, the cheapest to lay first: a lost probe gives trophies to the attacker. */
const CHEAPEST_FIRST = UNITS.map((_, i) => i).sort((a, b) => (UNITS[a]?.food ?? 0) - (UNITS[b]?.food ?? 0));

/** The watched places without a single ant. */
export const placesWithoutProbe = (armies: Record<Place, Army>, watched: readonly Place[]): Place[] =>
  PLACES.filter((place) => watched.includes(place) && total(armies[place]) === 0);

/**
 * The moves that put an ant on each watched place without one: the cheapest unit another place can spare (a watched
 * place keeps at least one ant), taken where there are the most of it. `missing`: places left without a probe, too
 * few ants home.
 */
export function probeMoves(
  armies: Record<Place, Army>,
  watched: readonly Place[],
): { moves: ProbeMove[]; missing: Place[] } {
  const left: Record<Place, number[]> = { field: [...armies.field], nest: [...armies.nest], lodge: [...armies.lodge] };
  const moves: ProbeMove[] = [];
  const missing: Place[] = [];
  for (const to of placesWithoutProbe(armies, watched)) {
    const move = spareAnt(left, watched, to);
    if (!move) {
      missing.push(to);
      continue;
    }
    left[move.from][move.unit] = (left[move.from][move.unit] ?? 0) - 1;
    left[to][move.unit] = (left[to][move.unit] ?? 0) + 1;
    moves.push(move);
  }
  return { moves, missing };
}

function spareAnt(armies: Record<Place, number[]>, watched: readonly Place[], to: Place): ProbeMove | null {
  const canGive = (place: Place) => place !== to && total(armies[place]) > (watched.includes(place) ? 1 : 0);
  for (const unit of CHEAPEST_FIRST) {
    const [from] = PLACES.filter((place) => canGive(place) && (armies[place][unit] ?? 0) > 0).sort(
      (a, b) => (armies[b][unit] ?? 0) - (armies[a][unit] ?? 0),
    );
    if (from) return { unit, from, to };
  }
  return null;
}

/**
 * `sent` minus the cheapest units needed for `probes` ants to stay home, `home` being every ant home before sending.
 * Where they stay does not matter: they are moved to the empty places afterwards.
 */
export function keepProbes(sent: Army, home: Army, probes: number): number[] {
  const kept = [...sent];
  let missing = probes - (total(home) - total(sent));
  for (const unit of CHEAPEST_FIRST) {
    if (missing <= 0) break;
    const count = Math.min(missing, kept[unit] ?? 0);
    kept[unit] = (kept[unit] ?? 0) - count;
    missing -= count;
  }
  return kept;
}
