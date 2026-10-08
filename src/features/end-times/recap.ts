import { SOURCE_PAGES, type EndItem, type EndKind, type Section } from "@/game/pages/end-times";

/** What ended stays listed this long, as « terminé ». */
export const DONE_KEPT_MS = 60 * 60_000;
/** Read longer ago than this, a row says when it was seen. */
export const STALE_MS = 24 * 60 * 60_000;
/** Read longer ago than this, a page is read again in the background. */
export const REFRESH_MS = 15 * 60_000;

export interface RecapRow {
  kind: EndKind;
  label: string;
  endsAt: Date;
  done: boolean;
  /** Items of the same queue ending after this one. */
  queued: number;
  readAt: Date;
  stale: boolean;
}

export type Sections = Partial<Record<EndKind, Section>>;

const KINDS = Object.keys(SOURCE_PAGES) as EndKind[];

/** Kinds whose items run side by side: one row each. The others are queues: their next item, and how many follow. */
const SIDE_BY_SIDE: readonly EndKind[] = ["hunt", "convoy"];

/** One row per hunt and convoy; for layings, buildings and research, the next to end and how many follow. Soonest first. */
export function recapRows(sections: Sections, now: Date): RecapRow[] {
  const rows: RecapRow[] = [];
  for (const kind of KINDS) {
    const section = sections[kind];
    if (!section) continue;
    const row = (item: EndItem, queued: number): RecapRow => ({
      kind,
      label: item.label,
      endsAt: item.endsAt,
      done: item.endsAt <= now,
      queued,
      readAt: section.readAt,
      stale: now.getTime() - section.readAt.getTime() > STALE_MS,
    });
    const kept = section.items.filter((item) => now.getTime() - item.endsAt.getTime() <= DONE_KEPT_MS);

    if (SIDE_BY_SIDE.includes(kind)) {
      rows.push(...kept.map((item) => row(item, 0)));
      continue;
    }
    const running = kept.filter((item) => item.endsAt > now);
    const next = running[0] ?? kept.at(-1);
    if (next) rows.push(row(next, Math.max(0, running.length - 1)));
  }
  return rows.sort((a, b) => a.endsAt.getTime() - b.endsAt.getTime());
}

/** Pages never read, or read too long ago. */
export function kindsToRefresh(sections: Sections, now: Date): EndKind[] {
  return KINDS.filter((kind) => {
    const section = sections[kind];
    return !section || now.getTime() - section.readAt.getTime() > REFRESH_MS;
  });
}
