// The space's roles as the background opens them (docs/features/site-chaine.md), for the chain, the map and the
// Members page: asked again whenever a relève brings new ones. No React here: the light script uses it.
import { watchChainRoles } from "@/data/chain-roles";
import type { ChainRolesAnswer } from "@/features/optizzz-account/envois";
import { askEnvois } from "@/features/optizzz-account/messages";

const ask = (origin: string) =>
  askEnvois<ChainRolesAnswer>({ type: "optizzz-envois", action: "chain-roles", origin }).catch(() => null);

/** Calls `onChange` with the background's answer now, then after each relève that changed the roles. */
export function followSiteChainRoles(origin: string, onChange: (answer: ChainRolesAnswer | null) => void): () => void {
  const refresh = () => void ask(origin).then(onChange);
  refresh();
  return watchChainRoles(refresh);
}
