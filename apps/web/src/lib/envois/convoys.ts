// The alliance's convoys on a space page (docs/features/site-envois.md, « Vues »): the members' Envois of the Convois
// category, opened here with the Clé d'alliance. An Envoi whose inside does not name its row is thrown away; a convoy
// reported by its sender and its recipient counts once, the newest reading kept.
import type { AllianceKeyring } from "@optizzz/crypto/alliance-key";
import { decryptData, encryptData } from "@optizzz/crypto/data";
import { dataFingerprint } from "@optizzz/crypto/data-fingerprint";
import { CONVOY_ITEM, type ConvoyItem } from "@optizzz/game/site-links/envoi-convoys";
import { newestPerFingerprint, openEnvoi, type EnvoiCrypto } from "@optizzz/game/site-links/envois";

/** libsodium's cipher, bound to a space's Clé d'alliance. */
export const envoiCrypto = (keyring: AllianceKeyring): EnvoiCrypto => ({
  encrypt: (text) => encryptData(text, keyring),
  decrypt: (blob) => decryptData(blob, keyring),
  fingerprint: (text) => dataFingerprint(text, keyring),
});

export interface AllianceConvoy extends ConvoyItem {
  fingerprint: string;
  observedAt: number;
  /** The member whose extension read it. */
  reporter: string;
  /** Declared by hand on the site (declarations.ts), not read by an extension. */
  declared?: true;
}

interface Row {
  server: string;
  playerId: number;
  category: string;
  fingerprint: string;
  blob: string;
}

/** The convoys of the rows that open; `refused` counts the others (altered, filed elsewhere, or a missing version). */
export async function openConvoys(
  rows: readonly Row[],
  keyring: AllianceKeyring,
  members: readonly { playerId: number; pseudo: string }[],
): Promise<{ convoys: AllianceConvoy[]; refused: number }> {
  const crypto = envoiCrypto(keyring);
  let refused = 0;
  const opened = await Promise.all(
    rows
      .filter((row) => row.category === "convoys")
      .map(async (row) => {
        try {
          const { observedAt, item } = await openEnvoi({ ...row, category: "convoys" }, crypto, CONVOY_ITEM);
          const reporter = members.find((m) => m.playerId === row.playerId)?.pseudo ?? "un ancien membre";
          return { ...item, fingerprint: row.fingerprint, observedAt, reporter };
        } catch {
          refused += 1;
          return null;
        }
      }),
  );
  return { convoys: newestPerFingerprint(opened.filter((c) => c !== null)), refused };
}

export interface ConvoyFilter {
  state: "all" | "transit" | "delivered";
  /** A member's pseudo: their convoys, sent or received. */
  member: string | null;
}

/**
 * The convoys the tab shows, on their way first (soonest arrival), then delivered (newest first). One on its way
 * whose arrival has passed is left out: it comes back as delivered once its sender or recipient reads their inbox.
 */
export function filterConvoys(convoys: readonly AllianceConvoy[], filter: ConvoyFilter, now: Date): AllianceConvoy[] {
  const member = filter.member?.toLowerCase() ?? null;
  const involves = (c: AllianceConvoy) =>
    member === null || c.from.toLowerCase() === member || c.to.toLowerCase() === member;
  const onWay = convoys
    .filter((c) => c.kind === "transit" && c.at > now.getTime() && involves(c))
    .sort((a, b) => a.at - b.at);
  const delivered = convoys.filter((c) => c.kind === "delivered" && involves(c)).sort((a, b) => b.at - a.at);
  if (filter.state === "transit") return onWay;
  if (filter.state === "delivered") return delivered;
  return [...onWay, ...delivered];
}
