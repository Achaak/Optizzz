// The plan as text, to paste in a collective message: each member launches their own attacks.
import { formatNumber } from "@/utils/number-format";
import { formatEndTimeShort } from "@/utils/time-format";

export interface PlannedLaunch {
  /** Place in the landing order, from 1: the plan holds when the attacks land in this order. */
  rank: number;
  attacker: string;
  target: string;
  ants: number;
  departure: Date;
  arrival: Date;
}

/** Who leaves first comes first; the landing order (`rank`) breaks ties. */
export const byDeparture = (launches: readonly PlannedLaunch[]): PlannedLaunch[] =>
  [...launches].sort((a, b) => a.departure.getTime() - b.departure.getTime() || a.rank - b.rank);

/** The launches in the order given, each numbered by its place in the landing order. */
export function planText(launches: readonly PlannedLaunch[], now: Date): string {
  if (launches.length === 0) return "";
  const firstArrival = new Date(Math.min(...launches.map((launch) => launch.arrival.getTime())));
  const time = (date: Date) => formatEndTimeShort(date, now);
  return [
    `Chaîne de TDC : arrivées une par minute à partir de ${time(firstArrival)}, dans l'ordre des numéros. Rien en défense sur le Terrain de Chasse.`,
    ...launches.map(
      (launch) =>
        `${String(launch.rank)}. départ ${time(launch.departure)} : ${launch.attacker} attaque ${launch.target} avec ${formatNumber(launch.ants)} fourmis (arrivée ${time(launch.arrival)})`,
    ),
  ].join("\n");
}
