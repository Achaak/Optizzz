// Shared by the alliance map and the convoy calculator.

/**
 * Travel time (attack or convoy) in seconds for a given distance,
 * depending on the sender's Attack Speed ("Vitesse d'attaque") research level.
 * Formula taken from Toolzzz — see docs/research/temps-de-trajet.md.
 */
export function travelTime(distance: number, attackSpeedLevel: number): number {
  return Math.ceil(0.9 ** attackSpeedLevel * 637200 * (1 - Math.exp(-distance / 350)));
}

/** Distance between two points of the map, in squares. */
export function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
