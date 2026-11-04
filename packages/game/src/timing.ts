// Timing an attack to the second: the server's clock, the aimed arrival at :59, when to click.
// Facts and decisions: docs/research/timing-attaques.md; feature: docs/features/timing.md.

import { formatEndTimeShort, fromParisParts, parisParts } from "./format/time-format";

const SECOND = 1000;

/** One request to the game: when it left and came back on the PC's clock, and the server's `Date` header (whole second). */
export interface ClockSample {
  sentAt: number;
  receivedAt: number;
  serverDate: number;
}

/** The server's clock relative to the PC's: server time = PC time + `offsetMs`, to ± `errorMs`. */
export interface ServerClock {
  offsetMs: number;
  errorMs: number;
  /** Half the median round trip: how long a request takes to reach the server. */
  oneWayMs: number;
}

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? (sorted[middle] ?? 0) : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
};

/**
 * The offset between the server's clock and the PC's, from a few requests. Each `Date` header says the server was
 * within that second at some point of the round trip: the offsets every reply allows are intersected. Replies that
 * disagree (a clock that jumped) fall back on the middle of each round trip.
 */
export function serverClock(samples: readonly ClockSample[]): ServerClock | null {
  if (samples.length === 0) return null;
  const oneWayMs = Math.round(median(samples.map((sample) => sample.receivedAt - sample.sentAt)) / 2);
  const low = Math.max(...samples.map((sample) => sample.serverDate - sample.receivedAt));
  const high = Math.min(...samples.map((sample) => sample.serverDate + SECOND - sample.sentAt));
  if (low <= high) return { offsetMs: (low + high) / 2, errorMs: (high - low) / 2, oneWayMs };
  const guesses = samples.map((sample) => sample.serverDate + SECOND / 2 - (sample.sentAt + sample.receivedAt) / 2);
  const offsetMs = guesses.reduce((sum, guess) => sum + guess, 0) / guesses.length;
  const errorMs = Math.max(SECOND, ...guesses.map((guess) => Math.abs(guess - offsetMs)));
  return { offsetMs, errorMs, oneWayMs };
}

/** The second of the minute an attack aims at: the last, settled after the others of its minute. */
export const AIMED_SECOND = 59;
/** The least time left to get ready before the click. */
export const PREPARATION_MS = 10_000;

/** The first instant at or after `from` (ms) whose second is :59. */
function next59(from: number): number {
  const whole = Math.ceil(from / SECOND) * SECOND;
  const second = new Date(whole).getUTCSeconds();
  return whole + ((AIMED_SECOND - second + 60) % 60) * SECOND;
}

/** The next arrival at :59 an attack sent now can still aim at, with at least 10 s to get ready (server time, ms). */
export function nextArrival(serverNow: number, travelSeconds: number): number {
  return next59(serverNow + PREPARATION_MS + travelSeconds * SECOND);
}

/** A minute of the day, as the player writes it in « Arrivée visée ». */
export interface AimedMinute {
  hours: number;
  minutes: number;
}

/** « 23 h 40 », « 23h40 », « 7:05 » → the minute; null when it is not a time of day. */
export function parseAimedMinute(text: string): AimedMinute | null {
  const match = /^\s*(\d{1,2})\s*(?:h|:)\s*(\d{2})\s*$/i.exec(text);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours < 24 && minutes < 60 ? { hours, minutes } : null;
}

/** The arrival at :59 of that minute, Paris time, the first whose departure is not past (server time, ms). */
export function arrivalInMinute(minute: AimedMinute, serverNow: number, travelSeconds: number): number {
  const today = parisParts(new Date(serverNow));
  for (let day = 0; ; day++) {
    const start = fromParisParts({ year: today.year, month: today.month, day: today.day + day, ...minute });
    const arrival = start.getTime() + AIMED_SECOND * SECOND;
    if (arrival - travelSeconds * SECOND >= serverNow) return arrival;
  }
}

/** How long « Cliquez maintenant » lasts, around the middle of the departure second. */
export const CLICK_WINDOW_MS = 600;

/** When to click, on the PC's clock (ms). */
export interface ClickWindow {
  start: number;
  middle: number;
  end: number;
}

/**
 * The server must receive the attack within its departure second (arrival − trip): aiming at the middle of it leaves
 * half a second either way. The click comes earlier by the request's way to the server, and moves to the PC's clock.
 */
export function clickWindow(arrival: number, travelSeconds: number, clock: ServerClock): ClickWindow {
  const middle = arrival - travelSeconds * SECOND + SECOND / 2 - clock.offsetMs - clock.oneWayMs;
  return { start: middle - CLICK_WINDOW_MS / 2, middle, end: middle + CLICK_WINDOW_MS / 2 };
}

export type ClickPhase = { kind: "wait"; msLeft: number } | { kind: "now" } | { kind: "late" };

/** Before, during or after the window, at `pcNow`. */
export function clickPhase(pcNow: number, window: ClickWindow): ClickPhase {
  if (pcNow < window.start) return { kind: "wait", msLeft: window.start - pcNow };
  return pcNow <= window.end ? { kind: "now" } : { kind: "late" };
}

const pad = (value: number) => String(value).padStart(2, "0");

/** A duration to the second: « 15 h 09 min 08 s », « 9 min 08 s », « 8 s ». */
export function formatSeconds(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${String(hours)} h ${pad(minutes)} min ${pad(seconds)} s`;
  if (minutes > 0) return `${String(minutes)} min ${pad(seconds)} s`;
  return `${String(seconds)} s`;
}

/** The time left before the window: whole seconds, in tenths under 5 s (« 2,4 s »), never 0. */
export function countdownText(msLeft: number): string {
  if (msLeft >= 5 * SECOND) return formatSeconds(Math.ceil(msLeft / SECOND));
  return `${(Math.ceil(msLeft / 100) / 10).toFixed(1).replace(".", ",")} s`;
}

export type Beep = "short" | "long";

const BEEPS: [number, Beep][] = [
  [3 * SECOND, "short"],
  [2 * SECOND, "short"],
  [SECOND, "short"],
  [0, "long"],
];

/**
 * The beeps due between two ticks, given the time left to the middle of the window at each: short ones at 3, 2 and
 * 1 s, a long one at the middle. A jump over more than a second (a tab put back in front) plays none.
 */
export function beepsBetween(msBefore: number, msNow: number): Beep[] {
  if (msBefore - msNow > SECOND) return [];
  return BEEPS.filter(([at]) => msBefore > at && msNow <= at).map(([, beep]) => beep);
}

/** « 08:30:40 »: the game's time to the second, Paris time. */
export function gameClock(time: number): string {
  const date = new Date(time);
  const { hours, minutes } = parisParts(date);
  return `${pad(hours)}:${pad(minutes)}:${pad(date.getUTCSeconds())}`;
}

/** « 23 h 39 min 59 s », « demain 6 h 00 min 59 s »: an arrival to the second, Paris time. */
export function arrivalText(arrival: number, now: number): string {
  return `${formatEndTimeShort(new Date(arrival), new Date(now))} min ${pad(new Date(arrival).getUTCSeconds())} s`;
}

/** The PC's clock against the game's, only beyond a second: « Votre horloge retarde de 3 s ». */
export function driftText(offsetMs: number): string | null {
  if (Math.abs(offsetMs) <= SECOND) return null;
  const seconds = String(Math.round(Math.abs(offsetMs) / SECOND));
  return `Votre horloge ${offsetMs > 0 ? "retarde" : "avance"} de ${seconds} s : le bloc en tient compte.`;
}

/** « Arrivée à 23:39:59 ✓ :59 visé » or « Arrivée à 23:40:00 ✗ une seconde trop tard ». */
export function verdictText(arrival: number, aimed: number): { onTime: boolean; text: string } {
  const head = `Arrivée à ${gameClock(arrival)}`;
  const gap = Math.round((arrival - aimed) / SECOND);
  if (gap === 0) return { onTime: true, text: `${head} ✓ :${String(AIMED_SECOND)} visé` };
  const seconds = Math.abs(gap) === 1 ? "une seconde" : `${String(Math.abs(gap))} secondes`;
  return { onTime: false, text: `${head} ✗ ${seconds} ${gap > 0 ? "trop tard" : "trop tôt"}` };
}

/** Where in its second the server should receive a request read for its `Date` header, ms. */
const READ_AT_MS = 200;

/**
 * How long to wait before a request, so that it reaches the server just after a second starts: its `Date` header
 * and what the page counts from it then fall in the same second.
 */
export function requestDelay(pcNow: number, clock: ServerClock): number {
  const reachesAt = pcNow + clock.oneWayMs + clock.offsetMs;
  return (((READ_AT_MS - reachesAt) % SECOND) + SECOND) % SECOND;
}
