import type { AllianceKeyring } from "./alliance-key";
import { concat, toBase64Url } from "./encoding";
import { CryptoError } from "./errors";
import { loadSodium } from "./sodium";

// Data fingerprint 1 (ADR 0005, « Empreinte d'une donnée d'alliance ») : BLAKE2b-128 keyed with the newest version of
// the Clé d'alliance, over the context and the UTF-8 text. Two members who report the same convoy compute the same
// fingerprint, which the site uses to recognise duplicates; without the key, it cannot test a guess (who sent what to
// whom) against it.
const CONTEXT = new TextEncoder().encode("optizzz data fingerprint 1");
const LENGTH = 16;

/** The fingerprint of a datum's identity (base64url, 22 characters), with the newest version of the Clé d'alliance. */
export async function dataFingerprint(text: string, keyring: AllianceKeyring): Promise<string> {
  const newest = keyring.reduce<AllianceKeyring[number] | undefined>(
    (best, key) => (best === undefined || key.version > best.version ? key : best),
    undefined,
  );
  if (newest === undefined) throw CryptoError.missingKeyVersion(1);
  const sodium = await loadSodium();
  const hash = sodium.crypto_generichash(LENGTH, concat(CONTEXT, new TextEncoder().encode(text)), newest.key);
  return toBase64Url(hash);
}
