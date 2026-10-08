import type { WorkItem, WorkKind } from "@/game/pages/work-queue";

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

const clamp = (value: number) => Math.min(1, Math.max(0, value));

/**
 * Where an item of the queue stands; `previousEnd` is the end of the item before it, if any. `sameLater`: items of
 * the same building or research after this one, whose levels the row's duration already counts.
 */
export function progressOf(
  item: WorkItem,
  previousEnd: Date | null,
  kind: WorkKind,
  now: Date,
  sameLater = 0,
): WorkProgress | null {
  // A queued item starts when the one before it ends: its duration is known exactly.
  if (previousEnd) {
    const duration = item.endsAt.getTime() - previousEnd.getTime();
    const progress = duration > 0 ? clamp((now.getTime() - previousEnd.getTime()) / duration) : 0;
    return { startsAt: previousEnd, progress };
  }
  if (item.nextLevelDuration === null) return null;
  // The row shows the level after the last one queued: one growth step back per level of this item and the later ones.
  const duration = item.nextLevelDuration / LEVEL_GROWTH[kind] ** (1 + sameLater);
  const startsAt = new Date(item.endsAt.getTime() - duration);
  const progress = clamp((now.getTime() - startsAt.getTime()) / duration);
  return { startsAt, progress };
}
