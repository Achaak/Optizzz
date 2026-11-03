// The back office's overview (docs/features/site-back-office.md): new accounts per day and what the spaces' Discord
// says. Counts and dates only: what the spaces hold is encrypted and stays so.
import { dayMonth, fromParisParts, parisParts } from "@optizzz/game/format/time-format";
import type { AdminAlert } from "./job-runs";

/** New accounts per Paris day over the last `days` days, oldest first, today included. */
export function dailyCounts(dates: readonly Date[], now: Date, days: number): { label: string; value: number }[] {
  const DAY = 24 * 60 * 60_000;
  const counts = new Map<string, number>();
  for (const date of dates) counts.set(dayMonth(date), (counts.get(dayMonth(date)) ?? 0) + 1);
  // From today's Paris noon, in steps of 24 h: a day of 23 or 25 hours never lands twice on the same Paris day.
  const noon = fromParisParts({ ...parisParts(now), hours: 12, minutes: 0 }).getTime();
  return Array.from({ length: days }, (_, i) => {
    const label = dayMonth(new Date(noon - (days - 1 - i) * DAY));
    return { label, value: counts.get(label) ?? 0 };
  });
}

export interface SpaceDiscordState {
  space: string;
  /** « S5 ». */
  server: string;
  /** Discord's HTTP status when it refused the space's announcements webhook, as a member's extension reported it. */
  refusedStatus: number | null;
  /** Discord's HTTP status when it said the site's reminders webhook is gone: no reminder leaves. */
  suspendedStatus: number | null;
}

/** The spaces whose Discord no longer takes their messages, in the reader's words. */
export function discordAlerts(spaces: readonly SpaceDiscordState[]): AdminAlert[] {
  return spaces.flatMap((s) => [
    ...(s.refusedStatus === null
      ? []
      : [
          {
            topic: "discord" as const,
            text: `${s.space} (${s.server}) : Discord refuse les annonces (${String(s.refusedStatus)}).`,
          },
        ]),
    ...(s.suspendedStatus === null
      ? []
      : [
          {
            topic: "discord" as const,
            text: `${s.space} (${s.server}) : rappels suspendus, Discord a refusé le webhook (${String(s.suspendedStatus)}).`,
          },
        ]),
  ]);
}
