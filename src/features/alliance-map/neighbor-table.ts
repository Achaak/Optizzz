import { membersByDistance, type Position } from "./neighbors";
import { travelTime } from "@/game/travel";

export interface KnownLevels {
  myId: number | null;
  /** My level, read on the Laboratory page. */
  labLevel: number | null;
  /** Global level entered by hand; replaces the Laboratory level for estimates. */
  manualLevel: number | null;
  /** Levels entered (or imported) for specific players. */
  byPlayer: ReadonlyMap<number, number>;
  /** When each of `byPlayer` was entered; missing for levels entered before they were dated. */
  enteredAt?: ReadonlyMap<number, Date>;
  /** Attack Speed from the states the members shared (« Partage »), with when it was read. */
  shared?: ReadonlyMap<number, { level: number; at: Date }>;
}

export interface Level {
  level: number;
  /** True when the player's level is unknown and the global level is used. */
  estimated: boolean;
}

export function globalLevel(levels: KnownLevels): number {
  return levels.manualLevel ?? levels.labLevel ?? 0;
}

/** A level entered by hand when newer than the shared one, my Laboratory level, the shared one, or the global one. */
export function levelOf(playerId: number, levels: KnownLevels): Level {
  const entered = levels.byPlayer.get(playerId);
  const shared = levels.shared?.get(playerId);
  const enteredAt = levels.enteredAt?.get(playerId)?.getTime() ?? 0;
  if (entered !== undefined && (!shared || enteredAt > shared.at.getTime()))
    return { level: entered, estimated: false };
  if (playerId === levels.myId && levels.labLevel !== null) return { level: levels.labLevel, estimated: false };
  if (shared) return { level: shared.level, estimated: false };
  return { level: globalLevel(levels), estimated: true };
}

export interface Trip extends Level {
  seconds: number;
}

export interface Row<P extends Position> {
  player: P;
  distance: number;
  withinK: boolean;
  /** From the selected player to this member. */
  outbound: Trip;
  /** From this member to the selected player. */
  inbound: Trip;
}

const trip = (distance: number, level: Level): Trip => ({ seconds: travelTime(distance, level.level), ...level });

export function neighborRows<P extends Position>(
  selected: P,
  members: readonly P[],
  k: number,
  levels: KnownLevels,
): Row<P>[] {
  const selectedLevel = levelOf(selected.id, levels);
  return membersByDistance(selected, members).map(({ player, distance }, rank) => ({
    player,
    distance,
    withinK: rank < k,
    outbound: trip(distance, selectedLevel),
    inbound: trip(distance, levelOf(player.id, levels)),
  }));
}
