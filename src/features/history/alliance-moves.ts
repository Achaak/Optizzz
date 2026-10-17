// When a player joined or left an alliance, from the alliance each export gives them — see docs/features/historique.md.
import { versionDate } from "@/data/export-history";
import { sameTag } from "@/game/diplomacy";
import { dayMonth } from "@/utils/time-format";
import type { Snapshot } from "./api";

export interface AllianceMove {
  /** Alliance left, null when the player had none. */
  from: string | null;
  /** Alliance joined, null when the player left without joining another. */
  to: string | null;
  /** The move happened between these two exports (AAAAMMJJHHmm). */
  after: string;
  before: string;
}

const same = (a: string | null, b: string | null) => (a === null || b === null ? a === b : sameTag(a, b));

/**
 * The changes of alliance of `playerId` over `snapshots` (oldest first), latest first. `latest` (the latest export,
 * hourly) closes the series when it is more recent. Exports missing the player are skipped.
 */
export function allianceMoves(
  snapshots: readonly Snapshot[],
  playerId: number,
  latest?: { version: string; alliance: string | null },
): AllianceMove[] {
  const points = snapshots.flatMap((snapshot) =>
    snapshot.alliances.has(playerId)
      ? [{ version: snapshot.version, alliance: snapshot.alliances.get(playerId) ?? null }]
      : [],
  );
  const last = points.at(-1);
  if (latest && (!last || latest.version > last.version)) points.push(latest);

  const moves: AllianceMove[] = [];
  points.forEach((point, i) => {
    const previous = points[i - 1];
    if (previous && !same(previous.alliance, point.alliance))
      moves.push({ from: previous.alliance, to: point.alliance, after: previous.version, before: point.version });
  });
  return moves.reverse();
}

const DAY_MS = 24 * 3600 * 1000;

/**
 * When a move happened, on Paris days: the nightly export comes out at midnight, so a move between two of them
 * happened on the day of the first (« 07/10 »); « du 07/10 au 09/10 » when exports are missing.
 */
export function moveDays({ after, before }: Pick<AllianceMove, "after" | "before">): string {
  const from = versionDate(after);
  const to = new Date(versionDate(before).getTime() - 1);
  const first = dayMonth(from);
  const last = dayMonth(to);
  return first === last || to.getTime() - from.getTime() < DAY_MS ? first : `du ${first} au ${last}`;
}
