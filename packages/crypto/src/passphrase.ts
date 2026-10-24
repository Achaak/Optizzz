import { loadSodium } from "./sodium";
import { FRENCH_WORDS } from "./words-fr";

export const MIN_PASSPHRASE_LENGTH = 16;

const SUGGESTED_WORDS = 5;

/**
 * The form a passphrase is hashed in, so that what a phone keyboard adds does not lock the player out:
 * Unicode NFC (an accent typed as one or two code points), no outer spaces, single spaces between words.
 * Case is kept: the form turns off auto-capitalisation instead.
 */
export function normalizePassphrase(passphrase: string): string {
  return passphrase.normalize("NFC").trim().replace(/\s+/g, " ");
}

/** What is wrong with a passphrase, in French, or undefined when it is long enough. No strength meter. */
export function passphraseProblem(passphrase: string): string | undefined {
  // Characters as the player sees them (graphemes): an accented letter or an emoji counts once.
  const length = Array.from(
    new Intl.Segmenter("fr", { granularity: "grapheme" }).segment(normalizePassphrase(passphrase)),
  ).length;
  return length < MIN_PASSPHRASE_LENGTH ? "La phrase doit faire au moins 16 caractères." : undefined;
}

/** « Proposer une phrase » : five French words drawn by libsodium's CSPRNG, without modulo bias (55 bits). */
export async function suggestPassphrase(): Promise<string> {
  const sodium = await loadSodium();
  return Array.from({ length: SUGGESTED_WORDS }, () => {
    const word = FRENCH_WORDS[sodium.randombytes_uniform(FRENCH_WORDS.length)];
    if (word === undefined) throw new Error("Word index out of range");
    return word;
  }).join(" ");
}
