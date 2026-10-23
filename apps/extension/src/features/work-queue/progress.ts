import { levelKeyOf, levelTimeRatio } from "@optizzz/game/level-costs";
import type { WorkItem } from "@optizzz/game/pages/work-queue";

export interface WorkProgress {
  startsAt: Date;
  /** Between 0 and 1. */
  progress: number;
}

const clamp = (value: number) => Math.min(1, Math.max(0, value));

/**
 * Where an item of the queue stands; `previousEnd` is the end of the item before it, if any. `sameLater`: items of
 * the same building or research after this one, whose levels the row's duration already counts.
 */
export function progressOf(item: WorkItem, previousEnd: Date | null, now: Date, sameLater = 0): WorkProgress | null {
  // A queued item starts when the one before it ends: its duration is known exactly.
  if (previousEnd) {
    const duration = item.endsAt.getTime() - previousEnd.getTime();
    const progress = duration > 0 ? clamp((now.getTime() - previousEnd.getTime()) / duration) : 0;
    return { startsAt: previousEnd, progress };
  }
  const key = levelKeyOf(item.name);
  if (item.nextLevelDuration === null || !key) return null;
  // The row shows the level after the last one queued, its bonus included: the table says how much shorter this one is.
  const shownLevel = item.targetLevel + 1 + sameLater;
  const duration = Math.round(item.nextLevelDuration / levelTimeRatio(key, item.targetLevel, shownLevel));
  const startsAt = new Date(item.endsAt.getTime() - duration);
  const progress = clamp((now.getTime() - startsAt.getTime()) / duration);
  return { startsAt, progress };
}
