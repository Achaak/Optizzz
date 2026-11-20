// Players to recruit for an alliance: see docs/features/recrutement.md.
import { sameTag } from "../diplomacy";
import type { Player } from "../exports";
import { distance } from "../travel";

export interface RecruitFilters {
  minField: number | null;
  maxField: number | null;
  /** In squares from the alliance's centre. */
  maxDistance: number | null;
}

export interface Recruit {
  id: number;
  pseudo: string;
  field: number;
  /** The field's growth over 7 nights, 0.25 for +25 %; null for a player not in the export then. */
  gain: number | null;
  /** From the alliance's centre, in squares; null without a centre. */
  distance: number | null;
  /** Who colonizes the player, if anyone. */
  master: { pseudo: string; alliance: string | null } | null;
}

export interface RecruitsInput {
  players: readonly Player[];
  /** My alliance. */
  tag: string;
  /** Each player's field 7 nights ago, by id. */
  weekAgo: ReadonlyMap<number, number>;
  /** The probably inactive, by id. */
  inactive: ReadonlySet<number>;
  filters: RecruitFilters;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? (sorted[middle] ?? 0) : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

/**
 * The players without alliance, neither on holiday, banned nor probably inactive, within the filters, the fastest
 * growth first; the centre of the alliance is the median of its members' positions, which one far member does not move.
 */
export function recruits({ players, tag, weekAgo, inactive, filters }: RecruitsInput): {
  center: { x: number; y: number } | null;
  rows: Recruit[];
} {
  const members = players.filter((player) => player.alliance !== null && sameTag(player.alliance, tag));
  const center =
    members.length > 0
      ? { x: median(members.map((member) => member.x)), y: median(members.map((member) => member.y)) }
      : null;
  const byId = new Map(players.map((player) => [player.id, player]));
  const rows = players.flatMap((player): Recruit[] => {
    if (player.alliance !== null || player.onHoliday || player.isBanned || inactive.has(player.id)) return [];
    const squares = center ? distance(player, center) : null;
    if (filters.minField !== null && player.field < filters.minField) return [];
    if (filters.maxField !== null && player.field > filters.maxField) return [];
    if (filters.maxDistance !== null && (squares === null || squares > filters.maxDistance)) return [];
    const before = weekAgo.get(player.id);
    const master = player.masterPlayerId === null ? undefined : byId.get(player.masterPlayerId);
    return [
      {
        id: player.id,
        pseudo: player.pseudo,
        field: player.field,
        gain: before === undefined || before <= 0 ? null : (player.field - before) / before,
        distance: squares,
        master: master ? { pseudo: master.pseudo, alliance: master.alliance } : null,
      },
    ];
  });
  // The unknown growth last; between two of them, the bigger field first.
  rows.sort((a, b) =>
    a.gain === null || b.gain === null
      ? Number(a.gain === null) - Number(b.gain === null) || b.field - a.field
      : b.gain - a.gain,
  );
  return { center, rows };
}
