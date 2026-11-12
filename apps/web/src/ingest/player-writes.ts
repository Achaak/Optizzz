// What the cron writes to the current state's players: only what changed between two readings. Rewriting every row each
// hour took S4 (216 000 players) beyond ten minutes on the VPS.
import type { Player } from "@optizzz/game/exports";

export interface PlayerWrites {
  /** New players and players with any stored field changed. */
  upserts: Player[];
  /** Ids gone from the export. */
  removed: number[];
}

const samePlayer = (a: Player, b: Player) =>
  a.pseudo === b.pseudo &&
  a.alliance === b.alliance &&
  a.masterPlayerId === b.masterPlayerId &&
  a.x === b.x &&
  a.y === b.y &&
  a.field === b.field &&
  a.grade === b.grade &&
  a.buildingScore === b.buildingScore &&
  a.technologyScore === b.technologyScore &&
  a.trophyScore === b.trophyScore &&
  a.onHoliday === b.onHoliday &&
  a.isBanned === b.isBanned;

/** The writes that turn the stored `before` into `after`. */
export function playerWrites(before: readonly Player[], after: readonly Player[]): PlayerWrites {
  const was = new Map(before.map((player) => [player.id, player]));
  const upserts = after.filter((player) => {
    const old = was.get(player.id);
    return !old || !samePlayer(old, player);
  });
  const kept = new Set(after.map((player) => player.id));
  const removed = before.filter((player) => !kept.has(player.id)).map((player) => player.id);
  return { upserts, removed };
}
