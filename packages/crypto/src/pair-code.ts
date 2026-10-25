import { concat, fromBase64Url } from "./encoding";
import { CryptoError } from "./errors";
import { digitGroups } from "./fingerprint";
import { loadSodium } from "./sodium";

// Pair code 1 (ADR 0005, « Format chiffré ») : the code a person sends is BLAKE2b-256 of the context and their own
// 32-byte public key, written like a fingerprint (24 digits in groups of four). Each side of a pair sends its own
// code and computes the other's from the key the site shows it. The code depends on the sender's key alone: a code
// drawn from both keys would let the site, which picks both substituted keys, find a collision in about 2^40 tries.
const CONTEXT = new TextEncoder().encode("optizzz pair code 1");

/** The two codes of a pair, seen from one side. */
export interface PairCodes {
  /** The code to send to the other person (on Discord). */
  mine: string;
  /** The code the other person should send, computed from the key the site gives for them. */
  theirs: string;
}

/**
 * The Code de sécurité of a pair, from the two public keys (base64url): one's own, and the one the site gives for the
 * other person. Refuses twice the same key, with which one's own code would match.
 */
export async function pairCodes(mine: string, theirs: string): Promise<PairCodes> {
  const own = publicKeyBytes(mine);
  const other = publicKeyBytes(theirs);
  if (mine === theirs) throw CryptoError.of("malformed");
  const sodium = await loadSodium();
  const code = (key: Uint8Array) => digitGroups(sodium.crypto_generichash(32, concat(CONTEXT, key), null));
  return { mine: code(own), theirs: code(other) };
}

/**
 * Whether a pasted or typed code is the expected one. Spaces, dashes and line breaks are ignored; anything else
 * (letters, another kind of digit) refuses it.
 */
export function matchesPairCode(pasted: string, expected: string): boolean {
  const digits = pasted.replace(/[\s\-‐-―−]/g, "");
  return /^\d{24}$/.test(digits) && digits === expected.replace(/ /g, "");
}

function publicKeyBytes(publicKey: string): Uint8Array {
  const bytes = fromBase64Url(publicKey);
  if (bytes.length !== 32) throw CryptoError.of("malformed");
  return bytes;
}
