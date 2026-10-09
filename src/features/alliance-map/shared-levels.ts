// Attack Speed levels from the states members shared (« Partage », docs/features/partage-alliance.md), for the map and
// the chain.
import { useEffect, useState } from "react";
import { loadSharedStates, valueOf } from "@/data/shared-states";

export type SharedLevels = ReadonlyMap<number, { level: number; at: Date }>;

/** By player id; empty while loading, when « Partage d'alliance » is off, or outside an alliance. */
export function useSharedAttackSpeeds(
  origin: string,
  alliance: string | null,
  members: readonly { id: number; pseudo: string }[],
  enabled: boolean,
): SharedLevels {
  const [levels, setLevels] = useState<SharedLevels>(new Map());
  useEffect(() => {
    if (!enabled || !alliance) return;
    let current = true;
    void loadSharedStates(origin, alliance).then((states) => {
      if (!current) return;
      const shared = new Map<number, { level: number; at: Date }>();
      for (const member of members) {
        const value = valueOf(states, member.pseudo, "research.attackSpeed");
        if (value) shared.set(member.id, { level: value.value, at: value.at });
      }
      setLevels(shared);
    });
    return () => {
      current = false;
    };
  }, [origin, alliance, members, enabled]);
  return levels;
}

/** When each level of the map's `playerLevels` was entered, by player id. */
export const enteredAtOf = (playerLevelsAt: Record<string, number>): ReadonlyMap<number, Date> =>
  new Map(Object.entries(playerLevelsAt).map(([id, at]) => [Number(id), new Date(at)]));
