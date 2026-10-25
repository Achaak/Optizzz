import { describe, expect, it } from "vitest";
import { CryptoError } from "./errors";
import { fingerprint } from "./fingerprint";
import { matchesPairCode, pairCodes } from "./pair-code";
import { generateKeyPair } from "./personal-key";

// RFC 8032 §7.1, tests 1 and 2. Expected codes computed apart, in Python (hashlib.blake2b, digest_size=32):
// a change here breaks every code players are exchanging.
const RFC_TEST_1 = "11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo";
const RFC_TEST_2 = "PUAXw-hDiVqStwqnTRt-vJyYLM8uxJaMwM1V8Sr0Zgw";

describe("pair safety codes", () => {
  it("gives each side its own code, in six groups of four digits", async () => {
    const admin = await generateKeyPair();
    const newcomer = await generateKeyPair();
    const codes = await pairCodes(admin.publicKey, newcomer.publicKey);
    expect(codes.mine).toMatch(/^\d{4}( \d{4}){5}$/);
    expect(codes.theirs).toMatch(/^\d{4}( \d{4}){5}$/);
    expect(codes.mine).not.toBe(codes.theirs);
  });

  it("lets each side compute the code the other one sends", async () => {
    const admin = await generateKeyPair();
    const newcomer = await generateKeyPair();
    const adminSide = await pairCodes(admin.publicKey, newcomer.publicKey);
    const newcomerSide = await pairCodes(newcomer.publicKey, admin.publicKey);
    expect(adminSide.theirs).toBe(newcomerSide.mine);
    expect(newcomerSide.theirs).toBe(adminSide.mine);
  });

  it("is stable", async () => {
    expect(await pairCodes(RFC_TEST_1, RFC_TEST_2)).toEqual({
      mine: "7248 3612 8119 0987 0567 3121",
      theirs: "6755 3006 5736 7587 3403 9275",
    });
  });

  it("is not the fingerprint of the key", async () => {
    expect((await pairCodes(RFC_TEST_1, RFC_TEST_2)).mine).not.toBe(await fingerprint(RFC_TEST_1));
  });

  it("no longer matches when the site substitutes either key", async () => {
    const admin = await generateKeyPair();
    const newcomer = await generateKeyPair();
    const site = await generateKeyPair();
    const adminSide = await pairCodes(admin.publicKey, newcomer.publicKey);
    const newcomerSide = await pairCodes(newcomer.publicKey, admin.publicKey);

    // The site shows its own key to the Admin as the newcomer's: the Admin expects another code.
    const fooledAdmin = await pairCodes(admin.publicKey, site.publicKey);
    expect(matchesPairCode(newcomerSide.mine, fooledAdmin.theirs)).toBe(false);
    // The site shows its own key to the newcomer as the Admin's.
    const fooledNewcomer = await pairCodes(newcomer.publicKey, site.publicKey);
    expect(matchesPairCode(adminSide.mine, fooledNewcomer.theirs)).toBe(false);
  });

  it("does not accept one's own code", async () => {
    const admin = await generateKeyPair();
    const newcomer = await generateKeyPair();
    const codes = await pairCodes(newcomer.publicKey, admin.publicKey);
    expect(matchesPairCode(codes.mine, codes.theirs)).toBe(false);
  });

  it("refuses a pair made of the same key twice: one's own code would then match", async () => {
    const { publicKey } = await generateKeyPair();
    const error: unknown = await pairCodes(publicKey, publicKey).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(CryptoError);
    expect((error as CryptoError).code).toBe("malformed");
  });

  it("refuses something that is not a public key", async () => {
    const { publicKey } = await generateKeyPair();
    const error: unknown = await pairCodes(publicKey, "AAAA").catch((e: unknown) => e);
    expect((error as CryptoError).code).toBe("malformed");
  });
});

describe("comparing a pasted code", () => {
  const expected = "7248 3612 8119 0987 0567 3121";

  it("ignores spaces, dashes and line breaks", () => {
    expect(matchesPairCode("7248 3612 8119 0987 0567 3121", expected)).toBe(true);
    expect(matchesPairCode("724836128119098705673121", expected)).toBe(true);
    expect(matchesPairCode("7248-3612-8119-0987-0567-3121", expected)).toBe(true);
    expect(matchesPairCode("  7248 3612\n8119 0987\r\n0567\t3121 ", expected)).toBe(true);
    expect(matchesPairCode("7248 3612 – 8119 0987 0567 3121", expected)).toBe(true);
  });

  it("refuses one wrong, missing or extra digit", () => {
    expect(matchesPairCode("7248 3612 8119 0987 0567 3122", expected)).toBe(false);
    expect(matchesPairCode("7248 3612 8119 0987 0567 312", expected)).toBe(false);
    expect(matchesPairCode("7248 3612 8119 0987 0567 31211", expected)).toBe(false);
  });

  it("refuses anything else than digits", () => {
    expect(matchesPairCode("", expected)).toBe(false);
    expect(matchesPairCode("code : 7248 3612 8119 0987 0567 3121", expected)).toBe(false);
    expect(matchesPairCode("７２４８ 3612 8119 0987 0567 3121", expected)).toBe(false);
  });
});
