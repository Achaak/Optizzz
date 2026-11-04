// The alliance's floods on a space page (docs/features/site-envois.md, « Vues »): the members' Envois of the Floods
// category, opened here with the Clé d'alliance. An Envoi whose inside does not name its row is thrown away; the army
// sent, which the site hands to the space's Admins only, is opened the same way and left out when it does not name
// the flood's own row.
import type { AllianceKeyring } from "@optizzz/crypto/alliance-key";
import { FLOOD_ARMY, FLOOD_ITEM, type FloodItem } from "@optizzz/game/site-links/envoi-floods";
import { newestPerFingerprint, openEnvoi } from "@optizzz/game/site-links/envois";
import { envoiCrypto } from "./convoys";

export interface AllianceFlood extends FloodItem {
  fingerprint: string;
  observedAt: number;
  /** The army sent, by unit key: only for an Admin, and only for an attack of the Plan de flood. */
  army: Record<string, number> | null;
  /** Declared by hand on the page « Déclarer » (declarations.ts), not sent by the extension. */
  declared?: true;
}

interface Row {
  server: string;
  playerId: number;
  category: string;
  fingerprint: string;
  blob: string;
  /** The Admins' blob: null for a member, or when the flood has none. */
  detail?: string | null;
}

/** The floods of the rows that open; `refused` counts the others (altered, filed elsewhere, or a missing version). */
export async function openFloods(
  rows: readonly Row[],
  keyring: AllianceKeyring,
): Promise<{ floods: AllianceFlood[]; refused: number }> {
  const crypto = envoiCrypto(keyring);
  let refused = 0;
  const opened = await Promise.all(
    rows
      .filter((row) => row.category === "floods")
      .map(async (row) => {
        const filed = { ...row, category: "floods" as const };
        let flood: { observedAt: number; item: FloodItem };
        try {
          flood = await openEnvoi(filed, crypto, FLOOD_ITEM);
        } catch {
          refused += 1;
          return null;
        }
        const army = row.detail
          ? await openEnvoi({ ...filed, blob: row.detail }, crypto, FLOOD_ARMY).then(
              ({ item }) => item.army,
              () => null,
            )
          : null;
        return { ...flood.item, fingerprint: row.fingerprint, observedAt: flood.observedAt, army };
      }),
  );
  return { floods: newestPerFingerprint(opened.filter((f) => f !== null)), refused };
}

/**
 * The floods by target, as the « Floods » tab shows them: on their way (soonest arrival first, the target hit first
 * at the top), or arrived in the last 7 days the site keeps (latest first).
 */
export function floodsByTarget(
  floods: readonly AllianceFlood[],
  state: "transit" | "arrived",
  now: Date,
): { target: string; floods: AllianceFlood[] }[] {
  const shown = floods
    .filter((f) => (state === "transit" ? f.at > now.getTime() : f.at <= now.getTime()))
    .sort((a, b) => (state === "transit" ? a.at - b.at : b.at - a.at));
  const groups = new Map<string, { target: string; floods: AllianceFlood[] }>();
  for (const flood of shown) {
    const key = flood.target.toLowerCase();
    const group = groups.get(key) ?? { target: flood.target, floods: [] };
    group.floods.push(flood);
    groups.set(key, group);
  }
  return [...groups.values()];
}
