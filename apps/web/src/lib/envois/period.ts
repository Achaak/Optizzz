// The period of the statistics of the « Convois » and « Floods » tabs (docs/features/site-envois.md, « La période
// libre »): the last N days, or « du … au … », two Paris days both included, kept within what the site keeps.
import { fromParisParts, parisParts } from "@optizzz/game/format/time-format";

/** Two Paris days, « 2026-10-12 », both included. */
export interface DayRange {
  from: string;
  to: string;
}

/** The last N days, today included, or a free period. */
export type PeriodChoice = { days: number } | DayRange;

export interface ResolvedPeriod {
  /** How many Paris days. */
  days: number;
  /** Its last instant: now when it ends today. */
  end: Date;
  /** The free period as kept within its bounds, null for the last N days. */
  range: DayRange | null;
  /** Its first day. */
  first: string;
}

const DAY = 24 * 3600_000;
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** A day as a count of days, to add and compare. */
const dayNumber = (day: string) => Date.parse(`${day}T00:00:00Z`) / DAY;
const dayOf = (n: number) => new Date(n * DAY).toISOString().slice(0, 10);

/** The Paris day of `date`, « 2026-11-04 ». */
export function parisDay(date: Date): string {
  const { year, month, day } = parisParts(date);
  return dayOf(Date.UTC(year, month - 1, day) / DAY);
}

/** `day` moved by `n` days. */
export const addDays = (day: string, n: number) => dayOf(dayNumber(day) + n);

/** Midnight in Paris at the start of `day`. */
export function dayStart(day: string): number {
  const [year = 0, month = 0, date = 0] = day.split("-").map(Number);
  return fromParisParts({ year, month, day: date, hours: 0, minutes: 0 }).getTime();
}

/**
 * The days, end and bounds of a period. A free period is kept within the last `kept` days (what the site keeps) and
 * today, its days put in order.
 */
export function resolvePeriod(choice: PeriodChoice, now: Date, kept: number): ResolvedPeriod {
  const today = parisDay(now);
  if ("days" in choice) return { days: choice.days, end: now, range: null, first: addDays(today, 1 - choice.days) };
  const oldest = dayNumber(addDays(today, 1 - kept));
  const bound = (day: string) => Math.min(dayNumber(today), Math.max(oldest, dayNumber(day)));
  const [from, to] = [bound(choice.from), bound(choice.to)].sort((a, b) => a - b) as [number, number];
  const range = { from: dayOf(from), to: dayOf(to) };
  return {
    days: to - from + 1,
    end: range.to === today ? now : new Date(dayStart(addDays(range.to, 1)) - 1),
    range,
    first: range.from,
  };
}

const isDay = (value: string | null): value is string =>
  value !== null && DAY_PATTERN.test(value) && Number.isFinite(dayNumber(value)) && dayOf(dayNumber(value)) === value;

/** `?du=2026-10-12&au=2026-10-20`, null unless both are days. */
export function readRange(params: { get: (name: string) => string | null }): DayRange | null {
  const from = params.get("du");
  const to = params.get("au");
  return isDay(from) && isDay(to) ? { from, to } : null;
}
