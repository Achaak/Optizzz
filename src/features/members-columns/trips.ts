// Trips from my nest to each alliance member, for the members table. See docs/features/colonnes-membres.md.
import { distance, travelTime } from "@/game/travel";
import type { Player } from "@/data/exports";

export interface MemberTrip {
  /** In squares. */
  distance: number;
  travelSeconds: number;
}

/**
 * My trip to every other player of the export, by lowercase nickname, with my Attack Speed; empty when I am not in
 * the export yet (new player).
 */
export function tripsFrom(players: Player[], myPseudo: string, attackSpeed: number): Map<string, MemberTrip> {
  const trips = new Map<string, MemberTrip>();
  const me = players.find((player) => player.pseudo.toLowerCase() === myPseudo.toLowerCase());
  if (!me) return trips;
  for (const player of players) {
    if (player.id === me.id) continue;
    const squares = distance(me, player);
    trips.set(player.pseudo.toLowerCase(), { distance: squares, travelSeconds: travelTime(squares, attackSpeed) });
  }
  return trips;
}
