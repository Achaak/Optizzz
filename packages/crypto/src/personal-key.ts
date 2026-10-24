import { checkFormat, concat, fromBase64Url, readUint32, toBase64Url, uint32 } from "./encoding";
import { CryptoError } from "./errors";
import { normalizePassphrase, passphraseProblem } from "./passphrase";
import { loadSodium, type Sodium } from "./sodium";

/**
 * A person's identity (one per Compte Optizzz): an Ed25519 pair that signs, and from which the X25519 pair of the
 * sealed boxes is derived, so that one public key and one passphrase do both. The public key travels as base64url;
 * the private key is libsodium's 64-byte Ed25519 secret key (seed, then public key).
 */
export interface KeyPair {
  publicKey: string;
  privateKey: Uint8Array;
}

// Locked private key, format 2 (ADR 0005, « Format chiffré ») :
// [format 2][opslimit u32][memlimit u32][salt 16][nonce 24][XChaCha20-Poly1305(Ed25519 seed 32) + tag 16]
// The first 25 bytes (format, Argon2id parameters, salt) are the AEAD's additional data.
// Format 1 locked an X25519 private key; it was never stored, and is no longer read.
const FORMAT = 2;
const SALT_OFFSET = 9;
const HEADER_LENGTH = SALT_OFFSET + 16;
const NONCE_LENGTH = 24;
const LOCKED_LENGTH = HEADER_LENGTH + NONCE_LENGTH + 32 + 16;

/** Argon2id parameters for new locks: RFC 9106's second choice (t = 3, m = 64 MiB), with libsodium's p = 1. */
const OPSLIMIT = 3;
const MEMLIMIT = 64 * 1024 * 1024;

// Bounds accepted when reading: a stored blob must not make the browser hash for minutes or allocate gigabytes.
const MAX_OPSLIMIT = 10;
const MIN_MEMLIMIT = 8 * 1024 * 1024;
const MAX_MEMLIMIT = 256 * 1024 * 1024;

export async function generateKeyPair(): Promise<KeyPair> {
  const sodium = await loadSodium();
  const { publicKey, privateKey } = sodium.crypto_sign_keypair();
  return { publicKey: toBase64Url(publicKey), privateKey };
}

/** The X25519 pair of the sealed boxes, derived from the Ed25519 identity. */
export function boxKeyPair(sodium: Sodium, pair: KeyPair): { publicKey: Uint8Array; privateKey: Uint8Array } {
  if (pair.privateKey.length !== 64) throw CryptoError.of("malformed");
  return {
    publicKey: boxPublicKey(sodium, pair.publicKey),
    privateKey: sodium.crypto_sign_ed25519_sk_to_curve25519(pair.privateKey),
  };
}

/** The X25519 public key a box is sealed for, from an Ed25519 public key (base64url); refuses an invalid point. */
export function boxPublicKey(sodium: Sodium, publicKey: string): Uint8Array {
  const bytes = fromBase64Url(publicKey);
  if (bytes.length !== 32) throw CryptoError.of("malformed");
  try {
    return sodium.crypto_sign_ed25519_pk_to_curve25519(bytes);
  } catch {
    throw CryptoError.of("malformed");
  }
}

/** Encrypts the private key with a key derived from the passphrase. Returns the base64url blob the site keeps. */
export async function lockPrivateKey(pair: KeyPair, passphrase: string): Promise<string> {
  if (passphraseProblem(passphrase)) throw CryptoError.of("passphrase-too-short");
  const sodium = await loadSodium();
  const header = concat(
    new Uint8Array([FORMAT]),
    uint32(OPSLIMIT),
    uint32(MEMLIMIT),
    sodium.randombytes_buf(HEADER_LENGTH - SALT_OFFSET),
  );
  const key = deriveKey(sodium, passphrase, header);
  const nonce = sodium.randombytes_buf(NONCE_LENGTH);
  const seed = sodium.crypto_sign_ed25519_sk_to_seed(pair.privateKey);
  const ciphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(seed, header, null, nonce, key);
  sodium.memzero(seed);
  sodium.memzero(key);
  return toBase64Url(concat(header, nonce, ciphertext));
}

/** Opens a locked private key; any other passphrase throws `wrong-passphrase`. */
export async function unlockPrivateKey(locked: string, passphrase: string): Promise<KeyPair> {
  const bytes = fromBase64Url(locked);
  checkFormat(bytes, FORMAT);
  if (bytes.length !== LOCKED_LENGTH) throw CryptoError.of("malformed");
  const opslimit = readUint32(bytes, 1);
  const memlimit = readUint32(bytes, 5);
  if (opslimit < 1 || opslimit > MAX_OPSLIMIT || memlimit < MIN_MEMLIMIT || memlimit > MAX_MEMLIMIT) {
    throw CryptoError.of("malformed");
  }

  const sodium = await loadSodium();
  const header = bytes.subarray(0, HEADER_LENGTH);
  const key = deriveKey(sodium, passphrase, header);
  let seed: Uint8Array;
  try {
    seed = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
      null,
      bytes.subarray(HEADER_LENGTH + NONCE_LENGTH),
      header,
      bytes.subarray(HEADER_LENGTH, HEADER_LENGTH + NONCE_LENGTH),
      key,
    );
  } catch {
    throw CryptoError.of("wrong-passphrase");
  } finally {
    sodium.memzero(key);
  }
  const { publicKey, privateKey } = sodium.crypto_sign_seed_keypair(seed);
  sodium.memzero(seed);
  return { publicKey: toBase64Url(publicKey), privateKey };
}

/** Re-locks the private key under a new passphrase (new salt, current parameters); the key pair stays the same. */
export async function changePassphrase(locked: string, oldPassphrase: string, newPassphrase: string): Promise<string> {
  if (passphraseProblem(newPassphrase)) throw CryptoError.of("passphrase-too-short");
  const pair = await unlockPrivateKey(locked, oldPassphrase);
  try {
    return await lockPrivateKey(pair, newPassphrase);
  } finally {
    (await loadSodium()).memzero(pair.privateKey);
  }
}

/** Argon2id over the normalised passphrase, with the parameters and salt written in the header. */
function deriveKey(sodium: Sodium, passphrase: string, header: Uint8Array): Uint8Array {
  return sodium.crypto_pwhash(
    32,
    normalizePassphrase(passphrase),
    header.subarray(SALT_OFFSET, HEADER_LENGTH),
    readUint32(header, 1),
    readUint32(header, 5),
    sodium.crypto_pwhash_ALG_ARGON2ID13,
  );
}
