import { checkFormat, concat, fromBase64Url, isKeyVersion, readUint32, toBase64Url, uint32 } from "./encoding";
import { CryptoError } from "./errors";
import { boxKeyPair, boxPublicKey, type KeyPair } from "./personal-key";
import { loadSodium } from "./sodium";

/** One version of a Clé d'alliance: 32 random bytes for XChaCha20-Poly1305. */
export interface AllianceKey {
  version: number;
  key: Uint8Array;
}

/** Every version of a Clé d'alliance a member holds, oldest first. The newest encrypts; all of them decrypt. */
export type AllianceKeyring = readonly AllianceKey[];

/** A version sealed for one member, as the site stores it (one row per member and per version). */
export interface SealedAllianceKey {
  version: number;
  sealed: string;
}

// Sealed Clé d'alliance, format 1 (ADR 0005, « Format chiffré ») :
// [format 1][crypto_box_seal(recipient public key, [key version u32][key 32])]
// The version is inside the box, so the site cannot relabel a key as another version.
const FORMAT = 1;
const PLAINTEXT_LENGTH = 4 + 32;
const SEALED_LENGTH = 1 + 48 + PLAINTEXT_LENGTH;

/** A new space's first Clé d'alliance (version 1), drawn in the creator's browser. */
export async function createAllianceKeyring(): Promise<AllianceKeyring> {
  const sodium = await loadSodium();
  return [{ version: 1, key: sodium.crypto_aead_xchacha20poly1305_ietf_keygen() }];
}

/** After an exclusion: adds a new version (the highest plus one) and keeps the old ones to read old data. */
export async function rotateAllianceKey(keyring: AllianceKeyring): Promise<AllianceKeyring> {
  const sodium = await loadSodium();
  const version = Math.max(0, ...keyring.map((k) => k.version)) + 1;
  return [...keyring, { version, key: sodium.crypto_aead_xchacha20poly1305_ietf_keygen() }];
}

/** Seals one version for a member's public key (base64url): only their private key opens it. */
export async function sealAllianceKey(key: AllianceKey, publicKey: string): Promise<string> {
  if (!isKeyVersion(key.version) || key.key.length !== 32) throw CryptoError.of("malformed");
  const sodium = await loadSodium();
  const recipient = boxPublicKey(sodium, publicKey);
  const sealed = sodium.crypto_box_seal(concat(uint32(key.version), key.key), recipient);
  return toBase64Url(concat(new Uint8Array([FORMAT]), sealed));
}

/** Seals every version for an approved member: the space's history belongs to the alliance. */
export async function sealAllianceKeyring(keyring: AllianceKeyring, publicKey: string): Promise<SealedAllianceKey[]> {
  return Promise.all(
    keyring.map(async (key) => ({ version: key.version, sealed: await sealAllianceKey(key, publicKey) })),
  );
}

export async function openAllianceKey(sealed: string, pair: KeyPair): Promise<AllianceKey> {
  const bytes = fromBase64Url(sealed);
  checkFormat(bytes, FORMAT);
  if (bytes.length !== SEALED_LENGTH) throw CryptoError.of("malformed");
  const sodium = await loadSodium();
  let plaintext: Uint8Array;
  try {
    const box = boxKeyPair(sodium, pair);
    plaintext = sodium.crypto_box_seal_open(bytes.subarray(1), box.publicKey, box.privateKey);
  } catch {
    throw CryptoError.of("not-for-this-key");
  }
  const version = readUint32(plaintext, 0);
  if (!isKeyVersion(version)) throw CryptoError.of("malformed");
  return { version, key: plaintext.slice(4) };
}

/** Opens every sealed version a member received and sorts them into a keyring. */
export async function openAllianceKeyring(sealed: readonly string[], pair: KeyPair): Promise<AllianceKeyring> {
  const keys = await Promise.all(sealed.map((s) => openAllianceKey(s, pair)));
  return keys.sort((a, b) => a.version - b.version);
}
