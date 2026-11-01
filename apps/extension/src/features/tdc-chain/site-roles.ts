// Which roles the chain, the map and the Members page show (docs/features/site-chaine.md): the space's, set on
// optizzz.fr, when this extension could open them; otherwise the player's own, which those never overwrite.
import type { Role } from "@optizzz/game/tdc-chain/roles";
import type { ChainRolesAnswer } from "@/features/optizzz-account/envois";

export const SITE_ROLES_NO_KEY =
  "Votre alliance règle ses rôles sur optizzz.fr : ouvrez votre espace pour les reprendre.";

interface ChainRoles {
  roles: Record<string, Role> | null;
  keep: Record<string, number>;
}

export interface EffectiveChain extends ChainRoles {
  /** The space's roles: read-only here, changed on optizzz.fr. */
  fromSite: boolean;
  /** The space whose roles they are, for « Modifier sur optizzz.fr ». */
  spaceId: string | null;
  note: string | null;
}

/** `answer` is the background's (null when it did not answer: an extension not linked to a Compte Optizzz). */
export function effectiveChain(local: ChainRoles, answer: ChainRolesAnswer | null): EffectiveChain {
  if (answer?.problem === null)
    return {
      roles: answer.record.roles,
      keep: answer.record.keep,
      fromSite: true,
      spaceId: answer.spaceId,
      note: null,
    };
  return {
    roles: local.roles,
    keep: local.keep,
    fromSite: false,
    spaceId: null,
    note: answer?.problem === "no-key" ? SITE_ROLES_NO_KEY : null,
  };
}
