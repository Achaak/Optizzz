// What changed for the watched players and alliances between two readings of the exports — see docs/features/suivis.md.
import { versionDate } from "@optizzz/game/export-versions";
import type { Alliance, Player } from "@optizzz/game/exports";
import type { WatchEntry, WatchKey } from "@/data/watchlist";
import { watchKey } from "@/data/watchlist";
import {
  allianceChanges,
  allianceState,
  playerChanges,
  playerState,
  type AllianceState,
  type Change,
  type PlayerState,
} from "@optizzz/game/changes";

/** One reading of the exports, the watched entries only: a few hundred bytes. */
export interface WatchState {
  /** Players export version, AAAAMMJJHHmm. */
  version: string;
  players: Partial<Record<WatchKey, PlayerState>>;
  alliances: Partial<Record<WatchKey, AllianceState>>;
}

/** A change, noticed between two readings: it happened after `since` and before `until` (export versions). */
export interface JournalEntry {
  key: WatchKey;
  since: string;
  until: string;
  change: Change;
}

/** The watched entries as the exports show them; an entry missing from them is left out. */
export function readState(
  entries: readonly WatchEntry[],
  version: string,
  players: readonly Player[],
  alliances: readonly Alliance[] | null,
): WatchState {
  const state: WatchState = { version, players: {}, alliances: {} };
  const byId = new Map(players.map((player) => [player.id, player]));
  for (const entry of entries) {
    if (entry.kind === "player") {
      const player = byId.get(entry.id);
      if (player) state.players[watchKey(entry)] = playerState(player, byId);
      continue;
    }
    const alliance = allianceState(entry.tag, players, alliances);
    if (alliance) state.alliances[watchKey(entry)] = alliance;
  }
  return state;
}

/**
 * The changes from `before` to `after`. An entry missing from `before` (just added, first reading) has none; one
 * missing from `after` is gone. The field is not a change: the view compares it with the « seen » mark.
 */
export function diffStates(before: WatchState, after: WatchState): JournalEntry[] {
  const journal: JournalEntry[] = [];
  const add = (key: WatchKey, changes: Change[]) => {
    for (const change of changes) journal.push({ key, since: before.version, until: after.version, change });
  };
  for (const [key, was] of Object.entries(before.players) as [WatchKey, PlayerState][]) {
    const now = after.players[key];
    add(key, now ? playerChanges(was, now) : [{ kind: "gone" }]);
  }
  for (const [key, was] of Object.entries(before.alliances) as [WatchKey, AllianceState][]) {
    const now = after.alliances[key];
    add(key, now ? allianceChanges(was, now) : [{ kind: "gone" }]);
  }
  return journal;
}

/** Field lost since the last reading, in percent of what it was; only the watched players and alliances present twice. */
export function fieldLosses(before: WatchState, after: WatchState): { key: WatchKey; name: string; percent: number }[] {
  const losses: { key: WatchKey; name: string; percent: number }[] = [];
  const check = (key: WatchKey, name: string, was: number, now: number) => {
    if (was > 0 && now < was) losses.push({ key, name, percent: ((was - now) / was) * 100 });
  };
  for (const [key, was] of Object.entries(before.players) as [WatchKey, PlayerState][]) {
    const now = after.players[key];
    if (now) check(key, now.pseudo, was.field, now.field);
  }
  for (const [key, was] of Object.entries(before.alliances) as [WatchKey, AllianceState][]) {
    const now = after.alliances[key];
    if (now) check(key, now.tag, was.field, now.field);
  }
  return losses;
}

/** The journal is kept this long. */
const JOURNAL_DAYS = 30;

/** Drops what is too old or about entries no longer watched. */
export function pruneJournal(journal: readonly JournalEntry[], keys: readonly WatchKey[], now: Date): JournalEntry[] {
  const oldest = now.getTime() - JOURNAL_DAYS * 24 * 3600 * 1000;
  return journal.filter((entry) => keys.includes(entry.key) && versionDate(entry.until).getTime() >= oldest);
}

/** What the journal noted about `entry` after its « seen » mark, oldest first. */
export function unseen(journal: readonly JournalEntry[], entry: WatchEntry): JournalEntry[] {
  const key = watchKey(entry);
  return journal.filter((noted) => noted.key === key && noted.until > entry.seen.version);
}

/** The field moved this much (in percent) since « seen » is a change worth showing. */
const NOTABLE_FIELD_PERCENT = 5;

/** The field's move since « seen »; null without a field then. */
export function fieldGap(seen: number, now: number): { delta: number; percent: number; notable: boolean } | null {
  if (seen <= 0) return null;
  const percent = ((now - seen) / seen) * 100;
  return { delta: now - seen, percent, notable: Math.abs(percent) >= NOTABLE_FIELD_PERCENT };
}
