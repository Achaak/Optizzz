// When each attack of a plan leaves, for them to land in order. See docs/features/chaine-tdc.md.

/** Between two arrivals: the plan holds when the attacks land in order. */
export const ARRIVAL_SPACING_SECONDS = 60;
/** Left to the players to launch before the first departure. */
const LEAD_SECONDS = 5 * 60;
const ROUNDING_MS = 5 * 60 * 1000;

export interface Slot {
  departure: Date;
  arrival: Date;
}

/** Arrivals from `firstArrival`, one spacing apart, for attacks of these travel times (seconds). */
export function schedule(firstArrival: Date, travelSeconds: readonly number[]): Slot[] {
  return travelSeconds.map((travel, i) => {
    const arrival = new Date(firstArrival.getTime() + i * ARRIVAL_SPACING_SECONDS * 1000);
    return { departure: new Date(arrival.getTime() - travel * 1000), arrival };
  });
}

/** The soonest first arrival that lets every attack leave after `now` plus a lead, rounded up to five minutes. */
export function defaultFirstArrival(now: Date, travelSeconds: readonly number[]): Date {
  const needed = Math.max(0, ...travelSeconds.map((travel, i) => travel - i * ARRIVAL_SPACING_SECONDS));
  const soonest = now.getTime() + (needed + LEAD_SECONDS) * 1000;
  return new Date(Math.ceil(soonest / ROUNDING_MS) * ROUNDING_MS);
}
