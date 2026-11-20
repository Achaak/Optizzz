// The payload of a player's hourly analysis, for its page and its public route (docs/features/site-analyse.md).
import { activityGrid, quietHours } from "@optizzz/game/analysis/activity";
import type { FloodSureness } from "@optizzz/game/analysis/floods";
import type { FloodLine, PlayerAnalysis } from "@optizzz/game/analysis/player-analysis";

interface StoredFlood {
  since: Date;
  at: Date;
  victimId: number;
  amount: number;
  attackers: number[];
  candidates: number[];
  alliance: string | null;
  sureness: string;
}

interface Named {
  id: number;
  pseudo: string;
  alliance: string | null;
}

/** The lines of the player `id`'s floods: lost as a victim, taken as one of the attackers. */
function floodLines(id: number, floods: readonly StoredFlood[], players: readonly Named[]): FloodLine[] {
  const byId = new Map(players.map((player) => [player.id, player]));
  const named = (ids: readonly number[]) =>
    ids.flatMap((other) => {
      const player = byId.get(other);
      return player ? [{ id: player.id, pseudo: player.pseudo, alliance: player.alliance }] : [];
    });
  return floods.map((flood) => {
    const lost = flood.victimId === id;
    return {
      since: flood.since.toISOString(),
      at: flood.at.toISOString(),
      direction: lost ? "lost" : "taken",
      amount: flood.amount,
      others: lost ? named(flood.attackers.length > 0 ? flood.attackers : flood.candidates) : named([flood.victimId]),
      alliance: lost ? flood.alliance : (byId.get(flood.victimId)?.alliance ?? null),
      sureness: flood.sureness as FloodSureness,
    };
  });
}

export function playerAnalysisOf(
  id: number,
  hourly: { moves: { since: Date; at: Date; delta: number }[]; floods: StoredFlood[]; players: Named[]; days: number },
): PlayerAnalysis {
  return {
    days: hourly.days,
    quietHours: hourly.days >= 7 ? quietHours(hourly.moves, hourly.days) : null,
    grid: activityGrid(hourly.moves),
    floods: floodLines(id, hourly.floods, hourly.players),
  };
}
