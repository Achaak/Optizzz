import { describe, expect, it } from "vitest";
import { CryptoError } from "./errors";
import { fingerprint } from "./fingerprint";
import { generateKeyPair } from "./personal-key";

// RFC 8032 §7.1, tests 1 and 2: Ed25519 public keys anyone can check. Expected values computed apart, in Python
// (hashlib.blake2b, digest_size=32): a change here breaks every fingerprint players have already compared.
const RFC_TEST_1 = "11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo";
const RFC_TEST_2 = "PUAXw-hDiVqStwqnTRt-vJyYLM8uxJaMwM1V8Sr0Zgw";

describe("fingerprint of a public key", () => {
  it("reads as six groups of four digits", async () => {
    const { publicKey } = await generateKeyPair();
    expect(await fingerprint(publicKey)).toMatch(/^\d{4}( \d{4}){5}$/);
  });

  it("is stable", async () => {
    expect(await fingerprint(RFC_TEST_1)).toBe("6501 5103 2815 7970 7679 2095");
    expect(await fingerprint(RFC_TEST_2)).toBe("8527 1315 4259 0645 7707 0107");
  });

  it("differs for two keys", async () => {
    const prints = await Promise.all(
      Array.from({ length: 20 }, async () => fingerprint((await generateKeyPair()).publicKey)),
    );
    expect(new Set(prints).size).toBe(20);
  });

  it("refuses something that is not a public key", async () => {
    const error: unknown = await fingerprint("AAAA").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(CryptoError);
    expect((error as CryptoError).code).toBe("malformed");
  });
});
