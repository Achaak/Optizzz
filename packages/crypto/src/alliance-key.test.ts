import { describe, expect, it } from "vitest";
import {
  createAllianceKeyring,
  openAllianceKey,
  openAllianceKeyring,
  rotateAllianceKey,
  sealAllianceKey,
  sealAllianceKeyring,
} from "./alliance-key";
import { fromBase64Url, toBase64Url } from "./encoding";
import { CryptoError } from "./errors";
import { generateKeyPair } from "./personal-key";

async function errorCode(promise: Promise<unknown>) {
  const error: unknown = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(CryptoError);
  return (error as CryptoError).code;
}

describe("alliance keyring", () => {
  it("starts at version 1 with a random 32-byte key", async () => {
    const keyring = await createAllianceKeyring();
    expect(keyring).toHaveLength(1);
    expect(keyring[0]?.version).toBe(1);
    expect(keyring[0]?.key).toHaveLength(32);
    expect((await createAllianceKeyring())[0]?.key).not.toEqual(keyring[0]?.key);
  });

  it("adds one version per change and keeps the old ones", async () => {
    const first = await createAllianceKeyring();
    const second = await rotateAllianceKey(first);
    const third = await rotateAllianceKey(second);
    expect(third.map((k) => k.version)).toEqual([1, 2, 3]);
    expect(third[0]).toEqual(first[0]);
    expect(third[2]?.key).not.toEqual(third[1]?.key);
    expect(first).toHaveLength(1);
  });
});

describe("sealing the alliance key for a member", () => {
  it("opens only with the recipient's private key", async () => {
    const [key] = await createAllianceKeyring();
    if (!key) throw new Error("no key");
    const member = await generateKeyPair();
    const stranger = await generateKeyPair();

    const sealed = await sealAllianceKey(key, member.publicKey);
    expect(await openAllianceKey(sealed, member)).toEqual(key);
    expect(await errorCode(openAllianceKey(sealed, stranger))).toBe("not-for-this-key");
  });

  it("detects a sealed key that was altered", async () => {
    const [key] = await createAllianceKeyring();
    if (!key) throw new Error("no key");
    const member = await generateKeyPair();
    const bytes = fromBase64Url(await sealAllianceKey(key, member.publicKey));
    bytes[bytes.length - 1] = (bytes[bytes.length - 1] ?? 0) ^ 1;
    expect(await errorCode(openAllianceKey(toBase64Url(bytes), member))).toBe("not-for-this-key");
  });

  it("refuses an unknown format and a malformed public key", async () => {
    const [key] = await createAllianceKeyring();
    if (!key) throw new Error("no key");
    const member = await generateKeyPair();
    const bytes = fromBase64Url(await sealAllianceKey(key, member.publicKey));
    bytes[0] = 9;
    expect(await errorCode(openAllianceKey(toBase64Url(bytes), member))).toBe("unsupported-format");
    expect(await errorCode(sealAllianceKey(key, "AAAA"))).toBe("malformed");
  });

  it("seals every version for a new member, who rebuilds the whole keyring", async () => {
    const keyring = await rotateAllianceKey(await rotateAllianceKey(await createAllianceKeyring()));
    const newcomer = await generateKeyPair();

    const sealed = await sealAllianceKeyring(keyring, newcomer.publicKey);
    expect(sealed.map((s) => s.version)).toEqual([1, 2, 3]);

    // The site may hand them back in any order.
    const reopened = await openAllianceKeyring(sealed.map((s) => s.sealed).reverse(), newcomer);
    expect(reopened).toEqual(keyring);
  });
});
