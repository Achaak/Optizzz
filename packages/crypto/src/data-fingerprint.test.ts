import { describe, expect, it } from "vitest";
import { createAllianceKeyring, rotateAllianceKey } from "./alliance-key";
import { dataFingerprint } from "./data-fingerprint";
import { CryptoError } from "./errors";

const CONVOY = "delivered|s5|messor|polyergus|0|350000|1761405060000";

describe("fingerprint of an alliance datum (dedup of Envois)", () => {
  it("is the same for the same text and key, on every call", async () => {
    const keyring = await createAllianceKeyring();
    const first = await dataFingerprint(CONVOY, keyring);
    expect(first).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(await dataFingerprint(CONVOY, keyring)).toBe(first);
  });

  it("differs for another text, and for another alliance's key", async () => {
    const ours = await createAllianceKeyring();
    const theirs = await createAllianceKeyring();
    const fingerprint = await dataFingerprint(CONVOY, ours);
    expect(await dataFingerprint(`${CONVOY}1`, ours)).not.toBe(fingerprint);
    expect(await dataFingerprint(CONVOY, theirs)).not.toBe(fingerprint);
  });

  it("is keyed by the newest version of the Clé d'alliance", async () => {
    const before = await createAllianceKeyring();
    const after = await rotateAllianceKey(before);
    const newestOnly = after.filter((key) => key.version === 2);
    expect(await dataFingerprint(CONVOY, after)).toBe(await dataFingerprint(CONVOY, newestOnly));
    expect(await dataFingerprint(CONVOY, after)).not.toBe(await dataFingerprint(CONVOY, before));
  });

  it("needs a key", async () => {
    const error: unknown = await dataFingerprint(CONVOY, []).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(CryptoError);
    expect((error as CryptoError).code).toBe("missing-key-version");
  });
});
