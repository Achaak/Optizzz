import { concat, fromBase64Url } from "./encoding";
import { CryptoError } from "./errors";
import { loadSodium } from "./sodium";

// Fingerprint 1 (ADR 0005, « Format chiffré ») : BLAKE2b-256 of the context and the 32-byte public key; the first
// 16 bytes as a big-endian integer, modulo 10^24 (negligible bias), written as 24 digits in groups of four.
// About 80 bits: forging a key with the same fingerprint stays out of reach of whoever runs the site.
const CONTEXT = new TextEncoder().encode("optizzz fingerprint 1");
const DIGITS = 24;

/**
 * A public key (base64url) as digits two players can compare aloud or on Discord: « 6501 5103 2815 7970 7679 2095 ».
 * Same key, same fingerprint, on every device and version of Optizzz.
 */
export async function fingerprint(publicKey: string): Promise<string> {
  const key = fromBase64Url(publicKey);
  if (key.length !== 32) throw CryptoError.of("malformed");
  const sodium = await loadSodium();
  return digitGroups(sodium.crypto_generichash(32, concat(CONTEXT, key), null));
}

/** The first 16 bytes of a hash as a big-endian integer, modulo 10^24, in six groups of four digits. */
export function digitGroups(hash: Uint8Array): string {
  let value = 0n;
  for (const byte of hash.subarray(0, 16)) value = (value << 8n) | BigInt(byte);
  const digits = (value % 10n ** BigInt(DIGITS)).toString().padStart(DIGITS, "0");
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ");
}
