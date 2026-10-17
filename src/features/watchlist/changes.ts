// What changed for the watched players and alliances between two readings of the exports — see docs/features/suivis.md.
import { versionDate } from "@/data/export-history";
import type { Alliance, Player } from "@/data/exports";
import type { WatchEntry, WatchKey } from "@/data/watchlist";
import { watchKey } from "@/data/watchlist";
import { sameTag } from "@/game/diplomacy";

interface PlayerState {
  pseudo: string;
  alliance: string | null;
  field: number;
  onHoliday: boolean;
  isBanned: boolean;
  x: number;
  y: number;
}

interface AllianceState {
  tag: string;
  /** Members' pseudos, by id. */
  members: Record<number, string>;
  /** Total field (TDC). */
  field: number;
  /** Tags it declared war on, and those that declared war on it. */
  wars: string[];
  warsOn: string[];
  pacts: { tag: string; name: string }[];
}

/** One reading of the exports, the watched entries only: a few hundred bytes. */
export interface WatchState {
  /** Players export version, AAAAMMJJHHmm. */
  version: string;
  players: Partial<Record<WatchKey, PlayerState>>;
  alliances: Partial<Record<WatchKey, AllianceState>>;
}

export type Change =
  | { kind: "alliance"; from: string | null; to: string | null }
  | { kind: "holiday"; on: boolean }
  | { kind: "banned" }
  | { kind: "gone" }
  | { kind: "joined"; pseudo: string }
  | { kind: "left"; pseudo: string }
  | { kind: "war"; tag: string; declaredBy: "it" | "them" }
  | { kind: "war-ended"; tag: string }
  | { kind: "pact"; tag: string; name: string }
  | { kind: "pact-ended"; tag: string; name: string };

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
      if (player)
        state.players[watchKey(entry)] = {
          pseudo: player.pseudo,
          alliance: player.alliance,
          field: player.field,
          onHoliday: player.onHoliday,
          isBanned: player.isBanned,
          x: player.x,
          y: player.y,
        };
      continue;
    }
    const alliance = alliances?.find((candidate) => sameTag(candidate.tag, entry.tag));
    const members = players.filter((player) => player.alliance !== null && sameTag(player.alliance, entry.tag));
    if (!alliance && members.length === 0) continue;
    state.alliances[watchKey(entry)] = {
      tag: alliance?.tag ?? entry.tag,
      members: Object.fromEntries(members.map((player) => [player.id, player.pseudo])),
      field: alliance?.totalField ?? members.reduce((total, player) => total + player.field, 0),
      wars: alliance?.diplomacy.wars.filter((tag) => !sameTag(tag, entry.tag)) ?? [],
      warsOn: (alliances ?? [])
        .filter(
          (other) => !sameTag(other.tag, entry.tag) && other.diplomacy.wars.some((tag) => sameTag(tag, entry.tag)),
        )
        .map((other) => other.tag),
      pacts: alliance?.diplomacy.pacts.map(({ tag, name }) => ({ tag, name: name.trim() })) ?? [],
    };
  }
  return state;
}

const sameAlliance = (a: string | null, b: string | null) => (a === null || b === null ? a === b : sameTag(a, b));
const hasTag = (tags: readonly string[], tag: string) => tags.some((other) => sameTag(other, tag));

function playerChanges(before: PlayerState, after: PlayerState): Change[] {
  const changes: Change[] = [];
  if (!sameAlliance(before.alliance, after.alliance))
    changes.push({ kind: "alliance", from: before.alliance, to: after.alliance });
  if (before.onHoliday !== after.onHoliday) changes.push({ kind: "holiday", on: after.onHoliday });
  if (!before.isBanned && after.isBanned) changes.push({ kind: "banned" });
  return changes;
}

function allianceChanges(before: AllianceState, after: AllianceState): Change[] {
  const changes: Change[] = [];
  for (const [id, pseudo] of Object.entries(after.members))
    if (!(id in before.members)) changes.push({ kind: "joined", pseudo });
  for (const [id, pseudo] of Object.entries(before.members))
    if (!(id in after.members)) changes.push({ kind: "left", pseudo });
  const warsBefore = [...before.wars, ...before.warsOn];
  const warsAfter = [...after.wars, ...after.warsOn];
  for (const tag of after.wars) if (!hasTag(warsBefore, tag)) changes.push({ kind: "war", tag, declaredBy: "it" });
  for (const tag of after.warsOn)
    if (!hasTag(warsBefore, tag) && !hasTag(after.wars, tag)) changes.push({ kind: "war", tag, declaredBy: "them" });
  for (const tag of warsBefore)
    if (!hasTag(warsAfter, tag) && !changes.some((c) => c.kind === "war-ended" && sameTag(c.tag, tag)))
      changes.push({ kind: "war-ended", tag });
  for (const pact of after.pacts)
    if (!before.pacts.some((other) => sameTag(other.tag, pact.tag))) changes.push({ kind: "pact", ...pact });
  for (const pact of before.pacts)
    if (!after.pacts.some((other) => sameTag(other.tag, pact.tag))) changes.push({ kind: "pact-ended", ...pact });
  return changes;
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
