// The members' states on a space page (docs/features/site-envois.md, « Vues », « État »): the Envois of Production,
// Chasses, Armée and Niveaux et chantiers, opened here with the Clé d'alliance, merged with the states pasted from
// Discord (« Mon état » of the extension), the newest reading of each part winning. The army by unit comes to an Admin
// only: the site leaves it out for the others.
import type { AllianceKeyring } from "@optizzz/crypto/alliance-key";
import { mergeMemberStates, type MemberStates, type SharedState } from "@optizzz/game/sharing/shared-state";
import { ARMY_UNITS, isStateCategory, stateItemSchema, stateOfEnvoi } from "@optizzz/game/site-links/envoi-states";
import { openEnvoi } from "@optizzz/game/site-links/envois";
import { envoiCrypto } from "./convoys";

interface Row {
  server: string;
  playerId: number;
  category: string;
  fingerprint: string;
  blob: string;
  /** The Admins' blob: null for a member. */
  detail?: string | null;
}

/**
 * The states of the rows that open, each named after the space's member who sent it (never after what its inside
 * says); `refused` counts the others (altered, filed elsewhere, or a missing version).
 */
export async function openStates(
  rows: readonly Row[],
  keyring: AllianceKeyring,
  context: { server: string; alliance: string; members: readonly { playerId: number; pseudo: string }[] },
): Promise<{ states: MemberStates[]; refused: number }> {
  const crypto = envoiCrypto(keyring);
  let refused = 0;
  const opened = await Promise.all(
    rows.map(async (row) => {
      const category = row.category;
      if (!isStateCategory(category)) return null;
      const filed = { ...row, category };
      try {
        const state = await openEnvoi(filed, crypto, stateItemSchema(category));
        const units =
          category === "army" && row.detail
            ? await openEnvoi({ ...filed, blob: row.detail }, crypto, ARMY_UNITS).then(
                ({ item }) => item.units,
                () => null,
              )
            : null;
        const pseudo = context.members.find((m) => m.playerId === row.playerId)?.pseudo ?? state.item.pseudo;
        return stateOfEnvoi(category, { ...state, item: { ...state.item, pseudo } }, units, context);
      } catch {
        refused += 1;
        return null;
      }
    }),
  );
  return { states: opened.filter((s) => s !== null), refused };
}

export interface MemberState {
  pseudo: string;
  /** Null when the member neither sends nor pasted anything. */
  states: MemberStates | null;
}

/**
 * Each member's states, pasted and sent, merged part by part: the newest reading wins, a reading seen twice counts
 * once. Members in the space's order; a state of someone not in the space is left out.
 */
export function memberStates(
  members: readonly string[],
  envois: readonly MemberStates[],
  pasted: readonly SharedState[],
): MemberState[] {
  const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
  return members.map((pseudo) => {
    const found: MemberStates[] = [
      ...envois.filter((s) => same(s.latest.pseudo, pseudo)),
      ...pasted.filter((s) => same(s.pseudo, pseudo)).map((latest) => ({ latest })),
    ];
    const sources = found.map((s) => ({
      latest: { ...s.latest, pseudo },
      ...(s.previous && { previous: { ...s.previous, pseudo } }),
    }));
    return { pseudo, states: mergeMemberStates(sources) };
  });
}
