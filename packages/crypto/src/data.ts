import type { AllianceKeyring } from "./alliance-key";
import { checkFormat, concat, fromBase64Url, readUint32, toBase64Url, uint32 } from "./encoding";
import { CryptoError } from "./errors";
import { loadSodium } from "./sodium";

// Encrypted alliance data, format 1 (ADR 0005, « Format chiffré ») :
// [format 1][key version u32][nonce 24][XChaCha20-Poly1305(UTF-8 text) + tag 16]
// The first 5 bytes are the AEAD's additional data: changing the format or the version breaks the tag.
const FORMAT = 1;
const HEADER_LENGTH = 1 + 4;
const NONCE_LENGTH = 24;
const TAG_LENGTH = 16;

/** Encrypts text (JSON, usually) with the newest version of the Clé d'alliance. Returns base64url. */
export async function encryptData(text: string, keyring: AllianceKeyring): Promise<string> {
  const newest = keyring.reduce<AllianceKeyring[number] | undefined>(
    (best, key) => (best === undefined || key.version > best.version ? key : best),
    undefined,
  );
  if (newest === undefined) throw CryptoError.missingKeyVersion(1);
  const sodium = await loadSodium();
  const header = concat(new Uint8Array([FORMAT]), uint32(newest.version));
  const nonce = sodium.randombytes_buf(NONCE_LENGTH);
  const ciphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(text, header, null, nonce, newest.key);
  return toBase64Url(concat(header, nonce, ciphertext));
}

/** Decrypts with the version of the Clé d'alliance the data names, old ones included. */
export async function decryptData(blob: string, keyring: AllianceKeyring): Promise<string> {
  const bytes = fromBase64Url(blob);
  checkFormat(bytes, FORMAT);
  if (bytes.length < HEADER_LENGTH + NONCE_LENGTH + TAG_LENGTH) throw CryptoError.of("malformed");
  const version = readUint32(bytes, 1);
  const key = keyring.find((k) => k.version === version);
  if (!key) throw CryptoError.missingKeyVersion(version);

  const sodium = await loadSodium();
  try {
    return sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
      null,
      bytes.subarray(HEADER_LENGTH + NONCE_LENGTH),
      bytes.subarray(0, HEADER_LENGTH),
      bytes.subarray(HEADER_LENGTH, HEADER_LENGTH + NONCE_LENGTH),
      key.key,
      "text",
    );
  } catch {
    throw CryptoError.of("undecryptable");
  }
}

/**
 * The version of the Clé d'alliance a datum names in clear (bytes 1–4), without opening it, or null when it is not
 * format 1: for the site to refuse a datum not encrypted with the newest version, and for a page to encrypt again one
 * written before a key rotation.
 */
export function dataKeyVersion(blob: string): number | null {
  let bytes: Uint8Array;
  try {
    bytes = fromBase64Url(blob.slice(0, 8));
  } catch {
    return null;
  }
  return bytes.length >= HEADER_LENGTH && bytes[0] === FORMAT ? readUint32(bytes, 1) : null;
}
