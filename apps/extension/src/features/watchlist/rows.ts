// The rows of the « Suivis » view, from the list, the journal and the latest exports.
import type { Alliance, Player } from "@optizzz/game/exports";
import { watchKey, type WatchEntry, type WatchKey } from "@/data/watchlist";
import { sameTag } from "@optizzz/game/diplomacy";
import { distance, travelTime } from "@optizzz/game/travel";
import { fieldGap, unseen, type JournalEntry } from "./changes";

type Gap = ReturnType<typeof fieldGap>;

interface Row {
  key: WatchKey;
  entry: WatchEntry;
  /** Total field now; null when gone. */
  field: number | null;
  gap: Gap;
  gone: boolean;
  /** Noted after the « seen » mark, latest first. */
  changes: JournalEntry[];
  /** Something to look at: a change, or the field moved enough. */
  isNew: boolean;
}

export interface PlayerRow extends Row {
  kind: "player";
  pseudo: string;
  /** The pseudo when added, if it changed since. */
  formerPseudo: string | null;
  alliance: string | null;
  onHoliday: boolean;
  isBanned: boolean;
  /** From my nest; null when I am not known. */
  distance: number | null;
  travelSeconds: number | null;
}

export interface AllianceRow extends Row {
  kind: "alliance";
  tag: string;
  members: number | null;
}

export interface RowsInput {
  entries: readonly WatchEntry[];
  journal: readonly JournalEntry[];
  players: readonly Player[];
  alliances: readonly Alliance[] | null;
  /** The player logged in, for the distances. */
  me: string | null;
  attackSpeed: number | undefined;
}

/** New first, then by name. */
const byInterest = <T extends Row & { name: string }>(a: T, b: T) =>
  Number(b.isNew) - Number(a.isNew) || a.name.localeCompare(b.name, "fr");

export function buildRows({ entries, journal, players, alliances, me, attackSpeed }: RowsInput): {
  players: PlayerRow[];
  alliances: AllianceRow[];
} {
  const byId = new Map(players.map((player) => [player.id, player]));
  const myNest = me ? players.find((player) => player.pseudo === me) : undefined;

  const playerRows = entries.flatMap((entry): (PlayerRow & { name: string })[] => {
    if (entry.kind !== "player") return [];
    const player = byId.get(entry.id);
    const changes = unseen(journal, entry).reverse();
    const gap = player ? fieldGap(entry.seen.field, player.field) : null;
    const squares = player && myNest && myNest.id !== player.id ? distance(myNest, player) : null;
    const pseudo = player?.pseudo ?? entry.pseudo;
    return [
      {
        kind: "player",
        key: watchKey(entry),
        entry,
        name: pseudo,
        pseudo,
        formerPseudo: player && player.pseudo !== entry.pseudo ? entry.pseudo : null,
        alliance: player?.alliance ?? null,
        field: player?.field ?? null,
        gap,
        gone: !player,
        onHoliday: player?.onHoliday ?? false,
        isBanned: player?.isBanned ?? false,
        distance: squares,
        travelSeconds: squares === null || attackSpeed === undefined ? null : travelTime(squares, attackSpeed),
        changes,
        isNew: changes.length > 0 || (gap?.notable ?? false),
      },
    ];
  });

  const allianceRows = entries.flatMap((entry): (AllianceRow & { name: string })[] => {
    if (entry.kind !== "alliance") return [];
    const alliance = alliances?.find((candidate) => sameTag(candidate.tag, entry.tag));
    const members = players.filter((player) => player.alliance !== null && sameTag(player.alliance, entry.tag));
    const gone = !alliance && members.length === 0;
    const field = gone ? null : (alliance?.totalField ?? members.reduce((total, player) => total + player.field, 0));
    const gap = field === null ? null : fieldGap(entry.seen.field, field);
    const changes = unseen(journal, entry).reverse();
    const tag = alliance?.tag ?? entry.tag;
    return [
      {
        kind: "alliance",
        key: watchKey(entry),
        entry,
        name: tag,
        tag,
        members: gone ? null : members.length,
        field,
        gap,
        gone,
        changes,
        isNew: changes.length > 0 || (gap?.notable ?? false),
      },
    ];
  });

  return { players: playerRows.sort(byInterest), alliances: allianceRows.sort(byInterest) };
}
