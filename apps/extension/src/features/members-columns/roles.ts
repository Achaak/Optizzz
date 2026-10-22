// Each member's role in the TDC chain, as the chain and the map show it. See docs/features/colonnes-membres.md.
import type { Player } from "@optizzz/game/exports";
import { memberBubbles, type MemberBubble } from "@/features/tdc-chain/role-styles";
import type { ChainSettings } from "@/features/tdc-chain/settings";

/**
 * Role and bubble of every member of my alliance, by lowercase nickname; their live fields (page Membres) replace
 * the export's, as in the chain. Empty when I am not in the export or in no alliance.
 */
export function rolesOfMembers(
  players: readonly Player[],
  myPseudo: string,
  liveFields: ReadonlyMap<string, number>,
  chain: Pick<ChainSettings, "roles" | "styles">,
): Map<string, MemberBubble> {
  const tag = players.find((player) => player.pseudo.toLowerCase() === myPseudo.toLowerCase())?.alliance;
  if (!tag) return new Map();
  const members = players
    .filter((player) => player.alliance === tag)
    .map((player) => ({ ...player, huntingField: liveFields.get(player.pseudo) ?? player.field }));
  const bubbles = memberBubbles(members, chain.roles, chain.styles);
  return new Map(
    members.flatMap((member) => {
      const bubble = bubbles.get(member.id);
      return bubble ? [[member.pseudo.toLowerCase(), bubble] as const] : [];
    }),
  );
}
