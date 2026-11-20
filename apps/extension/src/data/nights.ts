// The last nightly exports of every player, shared by the analyses (profile, targets, watchlist, Progression).
// They come from the History's cache: a night already loaded there is not downloaded again.
import { loadHistory, type Snapshot } from "@/features/history/api";
import { loadPlayersVersions } from "@/data/exports";
import { probableInactivity, type Inactivity, type Night } from "@optizzz/game/analysis/inactivity";
import { dailyVersions } from "@optizzz/game/export-versions";

/** Nights kept for the inactivity: a week, enough for « depuis 6 j ». */
export const INACTIVITY_DAYS = 8;

/** The nightly exports of the last `days` Paris days, today's included, oldest first. */
export async function loadRecentNights(origin: string, days = INACTIVITY_DAYS): Promise<Snapshot[]> {
  const versions = dailyVersions(await loadPlayersVersions(origin), days, new Date());
  return loadHistory(origin, versions);
}

/** The player's probable inactivity from the nights, then its live scores when the page shows them all. */
export function inactivityOf(nights: readonly Snapshot[], playerId: number, live?: Partial<Night>): Inactivity | null {
  const series: Night[] = nights.flatMap((snapshot) => {
    const scores = snapshot.players.get(playerId);
    return scores ? [{ field: scores.field, building: scores.building, technology: scores.technology }] : [];
  });
  if (live?.field !== undefined && live.building !== undefined && live.technology !== undefined) {
    series.push({ field: live.field, building: live.building, technology: live.technology });
  }
  return probableInactivity(series);
}
