// Each member's role in the TDC chain, as the chain and the map show it. See docs/features/colonnes-membres.md.
import type { Player } from "@optizzz/game/exports";
import { rungPlaces, type RungPlace } from "@optizzz/game/tdc-chain/roles";
import { memberBubbles, type MemberBubble } from "@/features/tdc-chain/role-styles";
import type { ChainSettings } from "@/features/tdc-chain/settings";

/** A member's role, and its place against the rungs next to it (`than` named by its bubble). */
export interface MemberRole extends MemberBubble {
  place?: { kind: "ok" } | { kind: "up" | "down"; than: string; thanRole: MemberBubble["role"] };
}

/**
 * Role, bubble and place of every member of my alliance, by lowercase nickname; their live fields (page Membres)
 * replace the export's, as in the chain. Empty when I am not in the export or in no alliance.
 */
export function rolesOfMembers(
  players: readonly Player[],
  myPseudo: string,
  liveFields: ReadonlyMap<string, number>,
  chain: Pick<ChainSettings, "roles" | "styles">,
): Map<string, MemberRole> {
  const tag = players.find((player) => player.pseudo.toLowerCase() === myPseudo.toLowerCase())?.alliance;
  if (!tag) return new Map();
  const members = players
    .filter((player) => player.alliance === tag)
    .map((player) => ({ ...player, huntingField: liveFields.get(player.pseudo) ?? player.field }));
  const bubbles = memberBubbles(members, chain.roles, chain.styles);
  const places = rungPlaces(
    new Map([...bubbles].map(([id, bubble]) => [id, bubble.role])),
    new Map(members.map((member) => [member.id, member.huntingField])),
  );
  const byId = new Map(members.map((member) => [member.id, member]));
  const placeOf = (place: RungPlace | undefined): MemberRole["place"] => {
    if (!place || place.kind === "ok") return place;
    const than = byId.get(place.than);
    const thanRole = bubbles.get(place.than)?.role;
    return than && thanRole ? { kind: place.kind, than: than.pseudo, thanRole } : undefined;
  };
  return new Map(
    members.flatMap((member) => {
      const bubble = bubbles.get(member.id);
      return bubble
        ? [[member.pseudo.toLowerCase(), { ...bubble, place: placeOf(places.get(member.id)) }] as const]
        : [];
    }),
  );
}
