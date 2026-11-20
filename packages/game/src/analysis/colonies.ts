// The colonies an alliance takes part in, from the export's masters. See docs/features/analyse-alliances.md.
import { sameTag } from "../diplomacy";

export interface ColonyPlayer {
  id: number;
  pseudo: string;
  alliance: string | null;
  /** Who colonizes the player, null when free. */
  masterPlayerId: number | null;
}

type Named = Pick<ColonyPlayer, "id" | "pseudo" | "alliance">;

export interface ColonyLink {
  master: Named;
  colony: Named;
}

/** A master and its colonies, for the tree of a chain. */
export interface ColonyNode {
  pseudo: string;
  alliance: string | null;
  colonies: ColonyNode[];
  /** Under the top master only: its colonies without colonies of their own, counted but not drawn. */
  more: number;
}

export interface AllianceColonies {
  /** Members colonized by players outside the alliance. */
  colonizedFromOutside: ColonyLink[];
  /** Colonies outside the alliance held by members. */
  heldOutside: ColonyLink[];
  /** A member colonizing another one. */
  internal: ColonyLink[];
  /** From their top master, the chains of more than one level that touch the alliance. */
  chains: ColonyNode[];
}

const named = ({ id, pseudo, alliance }: ColonyPlayer): Named => ({ id, pseudo, alliance });

export function allianceColonies(tag: string, players: readonly ColonyPlayer[]): AllianceColonies {
  const byId = new Map(players.map((player) => [player.id, player]));
  const isMember = (player: ColonyPlayer) => player.alliance !== null && sameTag(player.alliance, tag);
  const coloniesOf = new Map<number, ColonyPlayer[]>();
  for (const player of players) {
    if (player.masterPlayerId === null) continue;
    coloniesOf.set(player.masterPlayerId, [...(coloniesOf.get(player.masterPlayerId) ?? []), player]);
  }

  const result: AllianceColonies = { colonizedFromOutside: [], heldOutside: [], internal: [], chains: [] };
  const roots = new Set<number>();
  for (const colony of players) {
    const master = colony.masterPlayerId === null ? undefined : byId.get(colony.masterPlayerId);
    if (!master) continue;
    const link = { master: named(master), colony: named(colony) };
    if (isMember(master) && isMember(colony)) result.internal.push(link);
    else if (isMember(colony)) result.colonizedFromOutside.push(link);
    else if (isMember(master)) result.heldOutside.push(link);
    else continue;
    // The top of the chain: masters of masters, a loop stopped by `seen`.
    let top = master;
    const seen = new Set([top.id]);
    for (let up = byId.get(top.masterPlayerId ?? -1); up && !seen.has(up.id); up = byId.get(up.masterPlayerId ?? -1)) {
      seen.add(up.id);
      top = up;
    }
    roots.add(top.id);
  }

  const tree = (player: ColonyPlayer, seen: Set<number>): ColonyNode => ({
    pseudo: player.pseudo,
    alliance: player.alliance,
    colonies: (coloniesOf.get(player.id) ?? [])
      .filter((colony) => !seen.has(colony.id))
      .map((colony) => tree(colony, new Set([...seen, colony.id]))),
    more: 0,
  });
  const depth = (node: ColonyNode): number => 1 + Math.max(0, ...node.colonies.map(depth));
  for (const id of roots) {
    const root = byId.get(id);
    if (!root) continue;
    const node = tree(root, new Set([id]));
    if (depth(node) <= 2) continue;
    // A master of S2 holds dozens of colonies: only those leading further are drawn.
    const leading = node.colonies.filter((colony) => colony.colonies.length > 0);
    result.chains.push({ ...node, colonies: leading, more: node.colonies.length - leading.length });
  }
  return result;
}
