// The alliance's hunts on a space page (docs/features/site-envois.md, « Chasses par membre »): the members' hunts log,
// opened here with the Clé d'alliance. An Envoi whose inside does not name its row is thrown away.
import type { AllianceKeyring } from "@optizzz/crypto/alliance-key";
import { HUNT_ITEM, HUNTS_LOG, type HuntItem } from "@optizzz/game/site-links/envoi-hunts";
import { newestPerFingerprint, openEnvoi } from "@optizzz/game/site-links/envois";
import { envoiCrypto } from "./convoys";

export interface AllianceHunt extends HuntItem {
  fingerprint: string;
  observedAt: number;
}

interface Row {
  server: string;
  playerId: number;
  category: string;
  fingerprint: string;
  blob: string;
}

/** The hunts of the rows that open; `refused` counts the others (altered, filed elsewhere, or a missing version). */
export async function openHunts(
  rows: readonly Row[],
  keyring: AllianceKeyring,
): Promise<{ hunts: AllianceHunt[]; refused: number }> {
  const crypto = envoiCrypto(keyring);
  let refused = 0;
  const opened = await Promise.all(
    rows
      .filter((row) => row.category === HUNTS_LOG)
      .map(async (row) => {
        try {
          const { observedAt, item } = await openEnvoi({ ...row, category: HUNTS_LOG }, crypto, HUNT_ITEM);
          return { ...item, fingerprint: row.fingerprint, observedAt };
        } catch {
          refused += 1;
          return null;
        }
      }),
  );
  return { hunts: newestPerFingerprint(opened.filter((h) => h !== null)), refused };
}
