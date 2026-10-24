import { CryptoError } from "./errors";

// Every blob and public key travels as base64url without padding (RFC 4648 §5): safe in JSON and URLs.

export function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromBase64Url(text: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(text) || text.length % 4 === 1) throw CryptoError.of("malformed");
  const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/** Unsigned 32-bit big-endian integer. */
export function uint32(value: number): Uint8Array {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, value);
  return out;
}

export function readUint32(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset);
}

/**
 * Checks a blob's first byte, its format version: a higher one comes from a newer Optizzz,
 * 0 or an older one we never wrote is malformed.
 */
export function checkFormat(bytes: Uint8Array, expected: number): void {
  const format = bytes[0];
  if (format === expected) return;
  throw CryptoError.of(format !== undefined && format > expected ? "unsupported-format" : "malformed");
}

/** Key versions are positive 32-bit integers. */
export function isKeyVersion(version: number): boolean {
  return Number.isInteger(version) && version >= 1 && version <= 0xffff_ffff;
}
