// A player's growth against the players of its size: see docs/features/analyse-joueurs.md.

/** Fewer players of its size than this, and the rank says nothing. */
export const MIN_PEERS = 10;

/** How many players of its size it grew faster than, out of how many. */
export interface RelativeRank {
  faster: number;
  peers: number;
}

const growth = (start: number, end: number) => (end - start) / start;

/**
 * The relative rank of `playerId` between two exports (`start`, `end`: field by player id). Its size: the players
 * from half to twice its field at the start, present at both ends, out of `excluded` (inactive, on holiday, banned).
 * Measured on the growth of the field, in %.
 */
export function relativeRank(
  playerId: number,
  start: ReadonlyMap<number, number>,
  end: ReadonlyMap<number, number>,
  excluded: ReadonlySet<number>,
): RelativeRank | null {
  const from = start.get(playerId);
  const to = end.get(playerId);
  if (from === undefined || to === undefined || from <= 0) return null;
  const own = growth(from, to);
  let peers = 0;
  let faster = 0;
  for (const [id, field] of start) {
    const last = end.get(id);
    if (id === playerId || last === undefined || excluded.has(id)) continue;
    if (field * 2 < from || field > from * 2) continue;
    peers++;
    if (growth(field, last) < own) faster++;
  }
  return peers >= MIN_PEERS ? { faster, peers } : null;
}
