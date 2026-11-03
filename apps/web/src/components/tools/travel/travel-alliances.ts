// The travel tool towards alliances: from one sender to every member of the alliances chosen, from the closest to the
// farthest, each trip computed as `travelResult` (the formula shared with the extension), with the attack range from
// the sender's field. See docs/features/site-trajets.md.
import { inRange } from "@optizzz/game/attack";
import { travelResult, type TravelResult } from "./travel-result";

/** A member of an alliance chosen, as the latest export shows them. */
export interface AllianceMember {
  id: number;
  pseudo: string;
  alliance: string | null;
  x: number;
  y: number;
  /** Hunting field (TDC), cm². */
  field: number;
  onHoliday: boolean;
}

/** The sender: a player (`id` and `field` known) or a position (both null). */
export interface Sender {
  x: number;
  y: number;
  id: number | null;
  field: number | null;
}

/** Whether the sender may attack the member: in range, under 50 % of their field, or from 300 % on. Null from a position. */
export type Range = "in" | "small" | "big" | null;

export interface AllianceTrip extends AllianceMember, TravelResult {
  range: Range;
}

function rangeOf(sender: Sender, field: number): Range {
  if (sender.field === null) return null;
  if (inRange(sender.field, field)) return "in";
  return field * 2 < sender.field ? "small" : "big";
}

export function allianceTrips({
  sender,
  members,
  attackSpeed,
  departure,
  now,
}: {
  sender: Sender;
  members: readonly AllianceMember[];
  attackSpeed: number;
  departure: Date;
  now: Date;
}): AllianceTrip[] {
  return members
    .filter((member) => member.id !== sender.id)
    .map((member) => ({
      ...member,
      ...travelResult({ from: sender, to: member, attackSpeed, departure, now }),
      range: rangeOf(sender, member.field),
    }))
    .sort((a, b) => a.seconds - b.seconds || a.pseudo.localeCompare(b.pseudo, "fr"));
}

const RANGE_WORDS = { in: "à portée", small: "trop petit", big: "trop gros" } as const;

/** « à portée », « trop petit », « trop gros », followed by « en vacances » when they are. */
export function rangeWord(trip: AllianceTrip): string {
  const words = [trip.range && RANGE_WORDS[trip.range], trip.onHoliday && "en vacances"].filter(Boolean);
  return words.join(" · ");
}

/** « Copier le tableau »: one line per member, to paste on Discord. */
export const tripsText = (trips: readonly AllianceTrip[]) =>
  trips
    .map((trip) =>
      [
        trip.pseudo,
        trip.alliance ?? "—",
        `${String(trip.distance)} cases`,
        trip.time,
        `arrivée ${trip.arrivalText}`,
      ].join(" · "),
    )
    .join("\n");
