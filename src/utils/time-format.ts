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

/** The game runs on Paris time: every time shown is Paris time, whatever the player's computer says. */
const PARIS = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  weekday: "short",
  hourCycle: "h23",
});
const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export interface ParisParts {
  year: number;
  /** 1 to 12. */
  month: number;
  day: number;
  hours: number;
  minutes: number;
  /** 0 for Sunday. */
  weekday: number;
}

/** The date and time a Paris clock shows at `date`. */
export function parisParts(date: Date): ParisParts {
  const parts = Object.fromEntries(PARIS.formatToParts(date).map((part) => [part.type, part.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hours: Number(parts.hour),
    minutes: Number(parts.minute),
    weekday: WEEKDAY_INDEX[parts.weekday ?? ""] ?? 0,
  };
}

/** The instant a Paris clock shows these date and time. */
export function fromParisParts(parts: Omit<ParisParts, "weekday">): Date {
  const wanted = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hours, parts.minutes);
  // Paris is UTC+1 or UTC+2: correct a first guess by what Paris shows then (twice, around a change of time).
  let guess = wanted;
  for (let i = 0; i < 2; i++) {
    const shown = parisParts(new Date(guess));
    guess += wanted - Date.UTC(shown.year, shown.month - 1, shown.day, shown.hours, shown.minutes);
  }
  return new Date(guess);
}

const clock = (date: Date) => {
  const { hours, minutes } = parisParts(date);
  return `${String(hours)} h ${String(minutes).padStart(2, "0")}`;
};

/** When something ends, relative to today: « aujourd'hui 14 h 23 », Paris time. */
export function formatEndTime(end: Date, now: Date): string {
  const days = calendarDaysBetween(now, end);
  if (days === 0) return `aujourd'hui ${clock(end)}`;
  if (days === 1) return `demain ${clock(end)}`;
  if (days > 1 && days < 7) return `${WEEKDAYS[parisParts(end).weekday] ?? ""} ${clock(end)}`;
  return `${dayMonth(end)} ${clock(end)}`;
}

/** Same, without « aujourd'hui » where space is short: « 14 h 23 », « demain 2 h 10 ». */
export function formatEndTimeShort(end: Date, now: Date): string {
  return calendarDaysBetween(now, end) === 0 ? clock(end) : formatEndTime(end, now);
}

/** When something happened: « aujourd'hui 12 h 51 », « hier 12 h 51 », « 05/10 12 h 51 ». */
export function formatPastTime(when: Date, now: Date): string {
  const days = calendarDaysBetween(when, now);
  if (days === 0) return `aujourd'hui ${clock(when)}`;
  if (days === 1) return `hier ${clock(when)}`;
  return `${dayMonth(when)} ${clock(when)}`;
}

/** « 07/10 à 0 h 00 »: a date with its time, Paris time (exports, history). */
export function formatDateTime(date: Date): string {
  return `${dayMonth(date)} à ${clock(date)}`;
}

/** « 07/10 »: the day, Paris time. */
export function dayMonth(date: Date): string {
  const { day, month } = parisParts(date);
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}`;
}

/** Whole calendar days from `from` to `to` on Paris calendars, ignoring the time of day. */
function calendarDaysBetween(from: Date, to: Date): number {
  const midnight = (date: Date) => {
    const { year, month, day } = parisParts(date);
    return Date.UTC(year, month - 1, day);
  };
  return Math.round((midnight(to) - midnight(from)) / (24 * 60 * MINUTE));
}
