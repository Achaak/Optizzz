import type { ConvoyMessage } from "@optizzz/game/pages/messages";
import { formatNumber } from "@optizzz/game/format/number-format";
import { formatDateTime } from "@optizzz/game/format/time-format";

export interface ConvoyLoad {
  food: number;
  materials: number;
}

export interface PlayerConvoys extends ConvoyLoad {
  player: string;
}

export interface ConvoySummary {
  sent: PlayerConvoys[];
  received: PlayerConvoys[];
  sentTotal: ConvoyLoad;
  receivedTotal: ConvoyLoad;
}

/** Each player's sum, most first; a pseudo is the same whatever its case, written as first met. */
function byPlayer(messages: ConvoyMessage[]): PlayerConvoys[] {
  const players = new Map<string, PlayerConvoys>();
  for (const { player, food, materials } of messages) {
    const known = players.get(player.toLowerCase());
    if (known) {
      known.food += food;
      known.materials += materials;
    } else players.set(player.toLowerCase(), { player, food, materials });
  }
  return [...players.values()].sort(
    (a, b) => b.food + b.materials - (a.food + a.materials) || a.player.localeCompare(b.player, "fr"),
  );
}

const total = (players: PlayerConvoys[]): ConvoyLoad => ({
  food: players.reduce((sum, player) => sum + player.food, 0),
  materials: players.reduce((sum, player) => sum + player.materials, 0),
});

/**
 * What was delivered to and received from each player between `from` and `to`. A conversation counts whole at the
 * time of its last delivery: the inbox gives only its sum.
 */
export function summarizeConvoys(messages: ConvoyMessage[], from: Date, to: Date): ConvoySummary {
  const inPeriod = messages.filter(
    (message) => message.at.getTime() >= from.getTime() && message.at.getTime() <= to.getTime(),
  );
  const sent = byPlayer(inPeriod.filter((message) => message.direction === "sent"));
  const received = byPlayer(inPeriod.filter((message) => message.direction === "received"));
  return { sent, received, sentTotal: total(sent), receivedTotal: total(received) };
}

/** « 180 000 nourriture et 456 000 matériaux », a resource left out when there is none of it. */
export function loadText({ food, materials }: ConvoyLoad): string {
  const parts = [
    ...(food > 0 ? [`${formatNumber(food)} nourriture`] : []),
    ...(materials > 0 ? [`${formatNumber(materials)} matériaux`] : []),
  ];
  return parts.length > 0 ? parts.join(" et ") : "rien";
}

/**
 * The summary as text to paste on Discord: one line per player, then the totals. `coveredFrom`: before it, convoys
 * may be missing (the game deleted them before Optizzz read them), said when the period starts earlier.
 */
export function convoySummaryText(summary: ConvoySummary, from: Date, to: Date, coveredFrom: Date): string {
  const part = (title: string, players: PlayerConvoys[], totalTitle: string, sum: ConvoyLoad) =>
    players.length === 0
      ? [`${title} : aucun`]
      : [
          `${title} :`,
          ...players.map((player) => `- ${player.player} : ${loadText(player)}`),
          `${totalTitle} : ${loadText(sum)}`,
        ];
  return [
    `Convois du ${formatDateTime(from)} au ${formatDateTime(to)}`,
    ...part("Livrés", summary.sent, "Total livré", summary.sentTotal),
    ...part("Reçus", summary.received, "Total reçu", summary.receivedTotal),
    ...(coveredFrom.getTime() > from.getTime() ? [`(convois inconnus avant le ${formatDateTime(coveredFrom)})`] : []),
  ].join("\n");
}
