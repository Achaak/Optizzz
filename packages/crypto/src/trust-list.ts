import { checkFormat, concat, fromBase64Url, toBase64Url } from "./encoding";
import { CryptoError } from "./errors";
import type { KeyPair } from "./personal-key";
import { loadSodium, type Sodium } from "./sodium";
import type { SpaceTrust, VerifiedKey } from "./trust";

/** A member's trust list: for each space, the keys they checked by a code and the certificates they keep. */
export interface TrustList {
  spaces: SpaceTrust[];
}

// Locked trust list, format 1 (ADR 0005, « Format chiffré ») :
// [format 1][nonce 24][XChaCha20-Poly1305(JSON UTF-8) + tag 16], byte 0 as additional data.
// The key is BLAKE2b-256 keyed by the owner's Ed25519 seed, over KEY_CONTEXT: only the private key gives it, so the
// site can neither read the list nor write one the owner would open.
const FORMAT = 1;
const KEY_CONTEXT = new TextEncoder().encode("optizzz trust list 1");
const NONCE_LENGTH = 24;
const TAG_LENGTH = 16;

/** Encrypts and authenticates the trust list for its owner. Returns the base64url blob the site keeps. */
export async function lockTrustList(list: TrustList, owner: KeyPair): Promise<string> {
  const text = JSON.stringify(checkTrustList(list));
  const sodium = await loadSodium();
  const key = listKey(sodium, owner);
  const header = new Uint8Array([FORMAT]);
  const nonce = sodium.randombytes_buf(NONCE_LENGTH);
  try {
    return toBase64Url(
      concat(header, nonce, sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(text, header, null, nonce, key)),
    );
  } finally {
    sodium.memzero(key);
  }
}

/** Opens the owner's trust list; another key, or a single changed byte, throws `unreadable-trust-list`. */
export async function unlockTrustList(locked: string, owner: KeyPair): Promise<TrustList> {
  const bytes = fromBase64Url(locked);
  checkFormat(bytes, FORMAT);
  if (bytes.length < 1 + NONCE_LENGTH + TAG_LENGTH) throw CryptoError.of("malformed");
  const sodium = await loadSodium();
  const key = listKey(sodium, owner);
  let text: string;
  try {
    text = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
      null,
      bytes.subarray(1 + NONCE_LENGTH),
      bytes.subarray(0, 1),
      bytes.subarray(1, 1 + NONCE_LENGTH),
      key,
      "text",
    );
  } catch {
    throw CryptoError.of("unreadable-trust-list");
  } finally {
    sodium.memzero(key);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw CryptoError.of("malformed");
  }
  return checkTrustList(parsed);
}

function listKey(sodium: Sodium, owner: KeyPair): Uint8Array {
  if (owner.privateKey.length !== 64) throw CryptoError.of("malformed");
  const seed = sodium.crypto_sign_ed25519_sk_to_seed(owner.privateKey);
  try {
    return sodium.crypto_generichash(32, KEY_CONTEXT, seed);
  } finally {
    sodium.memzero(seed);
  }
}

/** The list rebuilt from known fields only; anything else than the format of ADR 0005 is `malformed`. */
function checkTrustList(value: unknown): TrustList {
  if (!isRecord(value) || !Array.isArray(value.spaces)) throw CryptoError.of("malformed");
  return { spaces: value.spaces.map(checkSpace) };
}

function checkSpace(value: unknown): SpaceTrust {
  if (
    !isRecord(value) ||
    typeof value.spaceId !== "string" ||
    value.spaceId === "" ||
    !Array.isArray(value.verified) ||
    !Array.isArray(value.certificates)
  ) {
    throw CryptoError.of("malformed");
  }
  const certificates = value.certificates.map((c) => {
    if (typeof c !== "string") throw CryptoError.of("malformed");
    fromBase64Url(c);
    return c;
  });
  return { spaceId: value.spaceId, verified: value.verified.map(checkVerified), certificates };
}

function checkVerified(value: unknown): VerifiedKey {
  if (
    !isRecord(value) ||
    typeof value.publicKey !== "string" ||
    fromBase64Url(value.publicKey).length !== 32 ||
    (value.role !== "admin" && value.role !== "member") ||
    typeof value.verifiedAt !== "number" ||
    !Number.isSafeInteger(value.verifiedAt) ||
    value.verifiedAt < 0
  ) {
    throw CryptoError.of("malformed");
  }
  return { publicKey: value.publicKey, role: value.role, verifiedAt: value.verifiedAt };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
