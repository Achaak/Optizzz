// The plan as text, to paste in a collective message: each member launches their own attacks.
import { formatNumber } from "@/utils/number-format";
import { formatEndTimeShort } from "@/utils/time-format";

export interface PlannedLaunch {
  attacker: string;
  target: string;
  ants: number;
  departure: Date;
  arrival: Date;
}

export function planText(launches: readonly PlannedLaunch[], now: Date): string {
  const first = launches[0];
  if (!first) return "";
  const time = (date: Date) => formatEndTimeShort(date, now);
  return [
    `Chaîne de TDC : arrivées une par minute à partir de ${time(first.arrival)}. Rien en défense sur le Terrain de Chasse.`,
    ...launches.map(
      (launch, i) =>
        `${String(i + 1)}. ${time(launch.departure)} : ${launch.attacker} attaque ${launch.target} avec ${formatNumber(launch.ants)} fourmis (arrivée ${time(launch.arrival)})`,
    ),
  ].join("\n");
}
