import { checkFormat, concat, fromBase64Url, isKeyVersion, readUint32, toBase64Url, uint32 } from "./encoding";
import { CryptoError } from "./errors";
import { boxKeyPair, boxPublicKey, type KeyPair } from "./personal-key";
import { loadSodium, type Sodium } from "./sodium";

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

/** Who seals, for whom, in which space. */
export interface SealingContext {
  /** The space's identifier on the site: the signature is only valid there. */
  spaceId: string;
  /** The member's public key (base64url), as the site gives it. */
  recipient: string;
  /** The Admin who seals and signs. */
  admin: KeyPair;
}

/** Who opens, in which space, and whose signatures they accept. */
export interface OpeningContext {
  spaceId: string;
  member: KeyPair;
  /**
   * Public keys (base64url) of the Admins the member has reason to believe. The package does not decide who they
   * are: the interface does (ADR 0005, « Format chiffré », modèle de confiance).
   */
  trusted: readonly string[];
}

// Sealed Clé d'alliance, format 2 (ADR 0005, « Format chiffré ») :
// [format 2][crypto_box_seal(recipient's X25519 key, [key version u32][key 32][Admin's public key 32][signature 64])]
// The signature (Ed25519, by the Admin) covers SIGN_CONTEXT, the space, the version, the recipient and the key:
// it cannot be replayed in another space, for another version or for another member.
// Format 1 (the same box without signature) is refused: anyone who knows a member's public key could seal one.
const FORMAT = 2;
const UNSIGNED_FORMAT = 1;
const SIGN_CONTEXT = new TextEncoder().encode("optizzz alliance key 2");
const KEY_OFFSET = 4;
const SIGNER_OFFSET = KEY_OFFSET + 32;
const SIGNATURE_OFFSET = SIGNER_OFFSET + 32;
const PLAINTEXT_LENGTH = SIGNATURE_OFFSET + 64;
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

/** Seals one version for a member, signed by the Admin: only the member's private key opens it. */
export async function sealAllianceKey(key: AllianceKey, context: SealingContext): Promise<string> {
  if (!isKeyVersion(key.version) || key.key.length !== 32 || context.admin.privateKey.length !== 64) {
    throw CryptoError.of("malformed");
  }
  const sodium = await loadSodium();
  const recipient = boxPublicKey(sodium, context.recipient);
  const signer = context.admin.privateKey.subarray(32);
  const message = signedMessage(context.spaceId, key.version, fromBase64Url(context.recipient), key.key);
  const signature = sodium.crypto_sign_detached(message, context.admin.privateKey);
  const sealed = sodium.crypto_box_seal(concat(uint32(key.version), key.key, signer, signature), recipient);
  return toBase64Url(concat(new Uint8Array([FORMAT]), sealed));
}

/** Seals every version for an approved member: the space's history belongs to the alliance. */
export async function sealAllianceKeyring(
  keyring: AllianceKeyring,
  context: SealingContext,
): Promise<SealedAllianceKey[]> {
  return Promise.all(
    keyring.map(async (key) => ({ version: key.version, sealed: await sealAllianceKey(key, context) })),
  );
}

/**
 * Opens one version sealed for the member, and checks it was signed for them, in this space, for this version,
 * by one of the trusted keys. Throws `bad-signature` (unsigned, forged, replayed) or `untrusted-signer`.
 */
export async function openAllianceKey(sealed: string, context: OpeningContext): Promise<AllianceKey> {
  const bytes = fromBase64Url(sealed);
  if (bytes[0] === UNSIGNED_FORMAT) throw CryptoError.of("bad-signature");
  checkFormat(bytes, FORMAT);
  if (bytes.length !== SEALED_LENGTH) throw CryptoError.of("malformed");
  const sodium = await loadSodium();
  const plaintext = openBox(sodium, bytes.subarray(1), context.member);

  const version = readUint32(plaintext, 0);
  if (!isKeyVersion(version)) throw CryptoError.of("malformed");
  const key = plaintext.slice(KEY_OFFSET, SIGNER_OFFSET);
  const signer = plaintext.subarray(SIGNER_OFFSET, SIGNATURE_OFFSET);
  const message = signedMessage(context.spaceId, version, fromBase64Url(context.member.publicKey), key);
  if (!verify(sodium, plaintext.subarray(SIGNATURE_OFFSET), message, signer)) throw CryptoError.of("bad-signature");
  const signedBy = toBase64Url(signer);
  if (!context.trusted.includes(signedBy)) throw CryptoError.untrustedSigner(signedBy);
  return { version, key };
}

/** Opens every sealed version a member received and sorts them into a keyring; one refusal refuses them all. */
export async function openAllianceKeyring(
  sealed: readonly string[],
  context: OpeningContext,
): Promise<AllianceKeyring> {
  const keys = await Promise.all(sealed.map((s) => openAllianceKey(s, context)));
  return keys.sort((a, b) => a.version - b.version);
}

/** What the Admin signs: [context][space id length u32][space id UTF-8][key version u32][recipient 32][key 32]. */
function signedMessage(spaceId: string, version: number, recipient: Uint8Array, key: Uint8Array): Uint8Array {
  const space = new TextEncoder().encode(spaceId);
  if (space.length === 0 || recipient.length !== 32) throw CryptoError.of("malformed");
  return concat(SIGN_CONTEXT, uint32(space.length), space, uint32(version), recipient, key);
}

function openBox(sodium: Sodium, box: Uint8Array, member: KeyPair): Uint8Array {
  const pair = boxKeyPair(sodium, member);
  try {
    return sodium.crypto_box_seal_open(box, pair.publicKey, pair.privateKey);
  } catch {
    throw CryptoError.of("not-for-this-key");
  } finally {
    sodium.memzero(pair.privateKey);
  }
}

function verify(sodium: Sodium, signature: Uint8Array, message: Uint8Array, signer: Uint8Array): boolean {
  try {
    return sodium.crypto_sign_verify_detached(signature, message, signer);
  } catch {
    // libsodium throws on a public key it cannot decode.
    return false;
  }
}
