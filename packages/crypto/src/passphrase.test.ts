import { describe, expect, it } from "vitest";
import { MIN_PASSPHRASE_LENGTH, passphraseProblem, suggestPassphrase } from "./passphrase";
import { FRENCH_WORDS } from "./words-fr";

describe("passphrase rules", () => {
  it("asks for at least 16 characters, spaces between words included", () => {
    expect(MIN_PASSPHRASE_LENGTH).toBe(16);
    expect(passphraseProblem("quinze caractèr")).toBe("La phrase doit faire au moins 16 caractères.");
    expect(passphraseProblem("seize caractères")).toBeUndefined();
  });

  it("does not count outer spaces, and counts an accent as one character", () => {
    expect(passphraseProblem("   quinze caractèr   ")).toBeDefined();
    expect(passphraseProblem("seize caractères".normalize("NFD"))).toBeUndefined();
  });
});

describe("French word list", () => {
  it("has 2048 distinct lowercase words in NFC (11 bits each)", () => {
    expect(FRENCH_WORDS).toHaveLength(2048);
    expect(new Set(FRENCH_WORDS).size).toBe(2048);
    for (const word of FRENCH_WORDS) {
      expect(word).toMatch(/^[a-zàâçéèêëîïôûùüÿœ]+$/);
      expect(word).toBe(word.normalize("NFC"));
    }
  });
});

describe("suggestPassphrase", () => {
  it("draws five words from the list, separated by spaces, long enough", async () => {
    const phrase = await suggestPassphrase();
    const words = phrase.split(" ");
    expect(words).toHaveLength(5);
    for (const word of words) expect(FRENCH_WORDS).toContain(word);
    expect(passphraseProblem(phrase)).toBeUndefined();
  });

  it("does not repeat itself", async () => {
    const phrases = new Set(await Promise.all(Array.from({ length: 50 }, () => suggestPassphrase())));
    expect(phrases.size).toBe(50);
  });
});
