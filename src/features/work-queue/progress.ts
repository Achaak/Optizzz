import type { WorkItem, WorkKind } from "./queue";

export interface WorkProgress {
  startsAt: Date;
  /** Between 0 and 1. */
  progress: number;
}

/**
 * How much longer each level takes than the previous one (docs/research/ressources-et-entretien.md).
 * The durations shown already include the Architecture / Salle d'analyse bonus.
 */
const LEVEL_GROWTH: Record<WorkKind, number> = { construction: 1.6, research: 1.7 };

/** Where an item of the queue stands; `previousEnd` is the end of the item before it, if any. */
export function progressOf(item: WorkItem, previousEnd: Date | null, kind: WorkKind, now: Date): WorkProgress | null {
  // A queued item waits for the one before it.
  if (previousEnd) return { startsAt: previousEnd, progress: 0 };
  if (item.nextLevelDuration === null) return null;
  const duration = item.nextLevelDuration / LEVEL_GROWTH[kind];
  const startsAt = new Date(item.endsAt.getTime() - duration);
  const progress = Math.min(1, Math.max(0, (now.getTime() - startsAt.getTime()) / duration));
  return { startsAt, progress };
}
