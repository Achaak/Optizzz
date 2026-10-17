// The toolbar popup's summary of a server's watch list, from what the last reading stored: no download.
import { watchKey, type WatchEntry, type WatchKey } from "@/data/watchlist";
import { fieldGap, unseen, type JournalEntry, type WatchState } from "./changes";
import { describeChange, describeWhen } from "./describe";

export interface ServerSummary {
  /** Watched entries with something new: a change, or the field moved enough since « seen ». */
  newCount: number;
  /** The latest unseen changes, « Rival : a quitté ABC pour XYZ (aujourd'hui 13 h 00) ». */
  latest: string[];
}

const LATEST = 3;

export function summarize(
  entries: readonly WatchEntry[],
  journal: readonly JournalEntry[],
  state: WatchState | null,
  now: Date,
): ServerSummary {
  const names: Partial<Record<WatchKey, string>> = {};
  let newCount = 0;
  const changes: JournalEntry[] = [];
  for (const entry of entries) {
    const key = watchKey(entry);
    const current = entry.kind === "player" ? state?.players[key] : state?.alliances[key];
    names[key] = current
      ? "pseudo" in current
        ? current.pseudo
        : current.tag
      : entry.kind === "player"
        ? entry.pseudo
        : entry.tag;
    const noted = unseen(journal, entry);
    const moved = current ? (fieldGap(entry.seen.field, current.field)?.notable ?? false) : false;
    if (noted.length > 0 || moved) newCount++;
    changes.push(...noted);
  }
  const latest = changes
    .sort((a, b) => b.until.localeCompare(a.until))
    .slice(0, LATEST)
    .map((noted) => `${names[noted.key] ?? ""} : ${describeChange(noted.change)} (${describeWhen(noted, now)})`);
  return { newCount, latest };
}
