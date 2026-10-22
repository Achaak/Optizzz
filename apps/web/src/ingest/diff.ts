// The Journal between two readings of a server's exports — see docs/features/site-public.md.
import {
  allianceChanges,
  allianceStates,
  playerChanges,
  playerState,
  type AllianceState,
  type Change,
} from "@optizzz/game/changes";
import type { Alliance, Player } from "@optizzz/game/exports";

/** A server's players and alliances as one export showed them. */
export interface Reading {
  /** Players export version, AAAAMMJJHHmm. */
  version: string;
  players: readonly Player[];
  alliances: readonly Alliance[];
}

/** One Change, about a player (by id) or an alliance (by tag), named as `after` names it. */
export interface NotedChange {
  playerId: number | null;
  tag: string | null;
  name: string;
  change: Change;
}

const byId = (players: readonly Player[]) => new Map(players.map((player) => [player.id, player]));

/** An alliance is « new » or « gone » with its tag: a tag no one carries any more is a gone alliance. */
function allianceNotes(before: Map<string, AllianceState>, after: Map<string, AllianceState>): NotedChange[] {
  const notes: NotedChange[] = [];
  const note = (state: AllianceState, change: Change) =>
    notes.push({ playerId: null, tag: state.tag, name: state.tag, change });
  for (const [key, now] of after) {
    const was = before.get(key);
    if (!was) note(now, { kind: "new" });
    else for (const change of allianceChanges(was, now)) note(now, change);
  }
  for (const [key, was] of before) if (!after.has(key)) note(was, { kind: "gone" });
  return notes;
}

/** Every Change from `before` to `after`: players first, then alliances. */
export function diffReadings(before: Reading, after: Reading): NotedChange[] {
  const notes: NotedChange[] = [];
  const playersBefore = byId(before.players);
  const playersAfter = byId(after.players);
  for (const player of after.players) {
    const note = (change: Change) => notes.push({ playerId: player.id, tag: null, name: player.pseudo, change });
    const was = playersBefore.get(player.id);
    if (!was) note({ kind: "new" });
    else
      for (const change of playerChanges(playerState(was, playersBefore), playerState(player, playersAfter)))
        note(change);
  }
  for (const player of before.players)
    if (!playersAfter.has(player.id))
      notes.push({ playerId: player.id, tag: null, name: player.pseudo, change: { kind: "gone" } });
  notes.push(
    ...allianceNotes(allianceStates(before.players, before.alliances), allianceStates(after.players, after.alliances)),
  );
  return notes;
}
