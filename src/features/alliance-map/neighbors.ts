import { distance } from "@/game/travel";

export interface Position {
  id: number;
  x: number;
  y: number;
}

export interface Neighbor<P extends Position> {
  player: P;
  distance: number;
}

/** The other members, from closest to farthest from `origin`. */
export function membersByDistance<P extends Position>(origin: P, members: readonly P[]): Neighbor<P>[] {
  return members
    .filter((member) => member.id !== origin.id)
    .map((player) => ({ player, distance: distance(origin, player) }))
    .sort((a, b) => a.distance - b.distance);
}

/** Key of an undirected link between two players: "lowerId-higherId". */
export function linkKey(a: number, b: number): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

/** Graph links: A and B are linked when either one is among the k nearest of the other. */
export function kNearestLinks(members: readonly Position[], k: number): Set<string> {
  const links = new Set<string>();
  for (const member of members) {
    for (const { player } of membersByDistance(member, members).slice(0, k)) {
      links.add(linkKey(member.id, player.id));
    }
  }
  return links;
}
