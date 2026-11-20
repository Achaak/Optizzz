// Probable inactivity, read from the nightly exports: see docs/features/analyse-joueurs.md.

/** What a nightly export says of a player. */
export interface Night {
  field: number;
  building: number;
  technology: number;
}

/** Nights in a row without a move before a player counts as probably inactive. */
export const INACTIVE_NIGHTS = 3;

/** How long the player has not moved, and whether their field only went down meanwhile (floods unanswered). */
export interface Inactivity {
  days: number;
  onlyLosses: boolean;
}

/**
 * The player's probable inactivity, from their `nights`, oldest first: null unless neither their Anthill nor their
 * Technology rose, nor their field, for at least 3 nights. Holidays and bans are the caller's: the game says them.
 */
export function probableInactivity(nights: readonly Night[]): Inactivity | null {
  let days = 0;
  let onlyLosses = false;
  for (let i = nights.length - 1; i > 0; i--) {
    const before = nights[i - 1];
    const after = nights[i];
    if (!before || !after) break;
    const moved =
      after.field > before.field || after.building !== before.building || after.technology !== before.technology;
    if (moved) break;
    if (after.field < before.field) onlyLosses = true;
    days++;
  }
  return days >= INACTIVE_NIGHTS ? { days, onlyLosses } : null;
}
