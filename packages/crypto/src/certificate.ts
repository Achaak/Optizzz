import { checkFormat, concat, fromBase64Url, readUint64, spaceIdBytes, toBase64Url, uint64 } from "./encoding";
import { CryptoError } from "./errors";
import type { KeyPair } from "./personal-key";
import { loadSodium } from "./sodium";

/**
 * What an Admin signs about a key, in one space: a member certificate (approval), an Admin certificate (nomination),
 * an Admin revocation (the Admin role withdrawn, the person stays a member) or an exclusion (out of the space).
 */
export type CertificateKind = "member" | "admin" | "admin-revocation" | "exclusion";

/** An opened certificate, whose signature has been checked for the space it was opened for. */
export interface Certificate {
  kind: CertificateKind;
  /** The Admin's public key (base64url) that signed it. */
  issuer: string;
  /** The public key (base64url) it is about. */
  subject: string;
  /** When the Admin signed it, in milliseconds since 1970, by the Admin's clock. */
  issuedAt: number;
}

export interface CertificateRequest {
  kind: CertificateKind;
  /** The space's identifier on the site: the signature is only valid there. */
  spaceId: string;
  /** The public key (base64url) certified or revoked. */
  subject: string;
  /** The Admin who signs. */
  admin: KeyPair;
  /** Defaults to now. A later statement about the same key outweighs an earlier one (ADR 0005, « Qui croire »). */
  issuedAt?: number;
}

// Certificate, format 1 (ADR 0005, « Format chiffré ») :
// [format 1][kind 1][issued at u64][issuer's public key 32][subject's public key 32][signature 64]
// The signature (Ed25519, by the issuer) covers SIGN_CONTEXT, the kind, the space, the date and the subject:
// it cannot be replayed in another space, for another key, as another kind or at another date.
const FORMAT = 1;
const SIGN_CONTEXT = new TextEncoder().encode("optizzz certificate 1");
const KIND_BYTES: Record<CertificateKind, number> = { member: 1, admin: 2, "admin-revocation": 3, exclusion: 4 };
const ISSUED_AT_OFFSET = 2;
const ISSUER_OFFSET = ISSUED_AT_OFFSET + 8;
const SUBJECT_OFFSET = ISSUER_OFFSET + 32;
const SIGNATURE_OFFSET = SUBJECT_OFFSET + 32;
const LENGTH = SIGNATURE_OFFSET + 64;

/** Signs a certificate or a revocation. Returns the base64url blob the site and the trust list keep. */
export async function signCertificate(request: CertificateRequest): Promise<string> {
  const issuedAt = request.issuedAt ?? Date.now();
  const subject = fromBase64Url(request.subject);
  if (
    !Number.isSafeInteger(issuedAt) ||
    issuedAt < 0 ||
    subject.length !== 32 ||
    request.admin.privateKey.length !== 64 ||
    request.subject === request.admin.publicKey
  ) {
    throw CryptoError.of("malformed");
  }
  const kind = KIND_BYTES[request.kind];
  const sodium = await loadSodium();
  const message = signedMessage(kind, request.spaceId, issuedAt, subject);
  const signature = sodium.crypto_sign_detached(message, request.admin.privateKey);
  const issuer = request.admin.privateKey.subarray(32);
  return toBase64Url(concat(new Uint8Array([FORMAT, kind]), uint64(issuedAt), issuer, subject, signature));
}

/**
 * Opens a certificate or a revocation and checks its signature for this space. Throws `bad-certificate` (forged,
 * altered, or signed for another space). Does not say whether the issuer is an Admin one should believe: that is
 * `whoToTrust`'s job.
 */
export async function openCertificate(blob: string, spaceId: string): Promise<Certificate> {
  const bytes = fromBase64Url(blob);
  checkFormat(bytes, FORMAT);
  if (bytes.length !== LENGTH) throw CryptoError.of("malformed");
  const kindByte = bytes[1] ?? 0;
  const kind = (Object.keys(KIND_BYTES) as CertificateKind[]).find((k) => KIND_BYTES[k] === kindByte);
  const issuedAt = readUint64(bytes, ISSUED_AT_OFFSET);
  if (kind === undefined || issuedAt === undefined) throw CryptoError.of("malformed");
  const issuer = bytes.subarray(ISSUER_OFFSET, SUBJECT_OFFSET);
  const subject = bytes.subarray(SUBJECT_OFFSET, SIGNATURE_OFFSET);

  const sodium = await loadSodium();
  const message = signedMessage(kindByte, spaceId, issuedAt, subject);
  let valid: boolean;
  try {
    valid = sodium.crypto_sign_verify_detached(bytes.subarray(SIGNATURE_OFFSET), message, issuer);
  } catch {
    // libsodium throws on a public key it cannot decode.
    valid = false;
  }
  if (!valid) throw CryptoError.of("bad-certificate");
  return { kind, issuer: toBase64Url(issuer), subject: toBase64Url(subject), issuedAt };
}

/** What the issuer signs: [context][kind 1][space id length u32][space id UTF-8][issued at u64][subject 32]. */
function signedMessage(kind: number, spaceId: string, issuedAt: number, subject: Uint8Array): Uint8Array {
  return concat(SIGN_CONTEXT, new Uint8Array([kind]), spaceIdBytes(spaceId), uint64(issuedAt), subject);
}
