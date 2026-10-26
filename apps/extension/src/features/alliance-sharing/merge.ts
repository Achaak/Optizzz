// « Partage » merges the states pasted from Discord with the members' Envois to their Alliance Space
// (docs/features/site-envois.md, « Vues »): for each member and each part, the newest reading wins.
import type { SharedStates } from "@/data/shared-states";
import { mergeMemberStates, type MemberStates } from "@optizzz/game/sharing/shared-state";

/**
 * The states of the members page's members (`members`, their nicknames there), pasted and sent merged. An Envoi of
 * someone not on the members page is left out, as a pasted state would be.
 */
export function withEnvois(
  states: SharedStates,
  envois: readonly MemberStates[],
  members: readonly string[],
): SharedStates {
  const merged: SharedStates["members"] = {};
  for (const pseudo of members) {
    const sent = envois
      .filter((e) => e.latest.pseudo.toLowerCase() === pseudo.toLowerCase())
      .map((e) => ({
        latest: { ...e.latest, pseudo },
        ...(e.previous && { previous: { ...e.previous, pseudo } }),
      }));
    const pasted = states.members[pseudo];
    const one = mergeMemberStates(pasted ? [pasted, ...sent] : sent);
    if (one) merged[pseudo] = one;
  }
  return { ...states, members: merged };
}
