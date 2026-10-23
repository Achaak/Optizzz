// The travel tool's result, with the game's formula shared with the extension (@optizzz/game/travel): the same ends
// and level give the same time. See docs/features/site-trajets.md and docs/research/temps-de-trajet.md.
import { formatEndTime, formatGameDuration, fromParisParts } from "@optizzz/game/format/time-format";
import { distance, travelTime } from "@optizzz/game/travel";
import type { PickedEnd, PickedPlayer } from "../player-picker";

interface Point {
  x: number;
  y: number;
}

/** Where an end is, once known: a typed position, or the player read from the site (`usePickedPlayer`). */
export function endPoint(end: PickedEnd | null, player: PickedPlayer | null | undefined): Point | null {
  if (end === null) return null;
  if (end.kind === "position") return end.x === null || end.y === null ? null : { x: end.x, y: end.y };
  return player ? { x: player.x, y: player.y } : null;
}

/** The departure: a day and time of Paris (« 2026-10-23T20:15 »), else now. */
export function departureTime(departure: string | null, now: Date): Date {
  const match = departure && /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(departure);
  if (!match) return now;
  const [year, month, day, hours, minutes] = match.slice(1).map(Number) as [number, number, number, number, number];
  return fromParisParts({ year, month, day, hours, minutes });
}

export interface TravelResult {
  /** Rounded up, as the game's profiles show it (« Distance : 29 »); the time uses the exact distance. */
  distance: number;
  /** Rounded down, as the game. */
  seconds: number;
  /** As the game writes a travel time: « 10H 1m 2s ». */
  time: string;
  arrival: Date;
  /** Paris time, relative to now: « aujourd'hui 13 h 36 ». */
  arrivalText: string;
}

export function travelResult({
  from,
  to,
  attackSpeed,
  departure,
  now,
}: {
  from: Point;
  to: Point;
  attackSpeed: number;
  departure: Date;
  now: Date;
}): TravelResult {
  const squares = distance(from, to);
  const seconds = travelTime(squares, attackSpeed);
  const arrival = new Date(departure.getTime() + seconds * 1000);
  return {
    distance: Math.ceil(squares),
    seconds,
    time: formatGameDuration(seconds * 1000),
    arrival,
    arrivalText: formatEndTime(arrival, now),
  };
}
