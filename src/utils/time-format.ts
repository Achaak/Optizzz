// Durations and times shown to the player, in the game's French wording.

const MINUTE = 60_000;
/** Beyond this, a date would be meaningless: the player's situation will have changed. */
const MAX_DAYS = 30;

/** Remaining time, rounded up to the minute: « 12 min ». */
export function formatDuration(ms: number): string {
  const minutes = Math.ceil(ms / MINUTE);
  if (minutes < 60) return `${String(minutes)} min`;
  if (minutes < 24 * 60) {
    const hours = Math.floor(minutes / 60);
    return `${String(hours)} h ${String(minutes % 60).padStart(2, "0")}`;
  }
  const hours = Math.ceil(minutes / 60);
  if (hours > MAX_DAYS * 24) return `plus de ${String(MAX_DAYS)} j`;
  return `${String(Math.floor(hours / 24))} j ${String(hours % 24)} h`;
}

const WEEKDAYS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];

const clock = (date: Date) => `${String(date.getHours())} h ${String(date.getMinutes()).padStart(2, "0")}`;

/** When something ends, relative to today: « aujourd'hui 14 h 23 ». */
export function formatEndTime(end: Date, now: Date): string {
  const days = calendarDaysBetween(now, end);
  if (days === 0) return `aujourd'hui ${clock(end)}`;
  if (days === 1) return `demain ${clock(end)}`;
  if (days < 7) return `${WEEKDAYS[end.getDay()] ?? ""} ${clock(end)}`;
  const date = `${String(end.getDate()).padStart(2, "0")}/${String(end.getMonth() + 1).padStart(2, "0")}`;
  return `${date} ${clock(end)}`;
}

/** Same, without « aujourd'hui » where space is short: « 14 h 23 », « demain 2 h 10 ». */
export function formatEndTimeShort(end: Date, now: Date): string {
  return calendarDaysBetween(now, end) === 0 ? clock(end) : formatEndTime(end, now);
}

/** Whole calendar days from `from` to `to`, ignoring the time of day. */
function calendarDaysBetween(from: Date, to: Date): number {
  const midnight = (date: Date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((midnight(to) - midnight(from)) / (24 * 60 * MINUTE));
}
