// Travel times between two nests: alliance map, TDC chain, targets, flood plan and convoy calculator.

/** An Attack Speed level, and whether it is only estimated. */
export interface Level {
  level: number;
  /** True when the player's level is unknown and a default level is used. */
  estimated: boolean;
}

/** A travel time with the level it was computed with. */
export interface Trip extends Level {
  seconds: number;
}

/**
 * Travel time (attack or convoy) in seconds for a given distance,
 * depending on the sender's Attack Speed ("Vitesse d'attaque") research level.
 * Formula taken from Toolzzz, rounded down as the game shows it on profiles — see docs/research/temps-de-trajet.md.
 */
export function travelTime(distance: number, attackSpeedLevel: number): number {
  return Math.floor(0.9 ** attackSpeedLevel * 637200 * (1 - Math.exp(-distance / 350)));
}

/** Distance between two points of the map, in squares. */
export function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
