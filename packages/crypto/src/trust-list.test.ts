import { describe, expect, it } from "vitest";
import { signCertificate } from "./certificate";
import { concat, fromBase64Url, toBase64Url } from "./encoding";
import { CryptoError } from "./errors";
import { generateKeyPair } from "./personal-key";
import { loadSodium } from "./sodium";
import { lockTrustList, unlockTrustList, type TrustList } from "./trust-list";

async function errorCode(promise: Promise<unknown>) {
  const error: unknown = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(CryptoError);
  return (error as CryptoError).code;
}

async function sampleList(): Promise<TrustList> {
  const admin = await generateKeyPair();
  const member = await generateKeyPair();
  return {
    spaces: [
      {
        spaceId: "space-s5-ad2",
        verified: [{ publicKey: admin.publicKey, role: "admin", verifiedAt: 1_761_400_000_000 }],
        certificates: [
          await signCertificate({ kind: "member", spaceId: "space-s5-ad2", subject: member.publicKey, admin }),
        ],
      },
      { spaceId: "space-s2-é", verified: [], certificates: [] },
    ],
  };
}

describe("encrypted trust list", () => {
  it("opens with the owner's private key", async () => {
    const owner = await generateKeyPair();
    const list = await sampleList();
    expect(await unlockTrustList(await lockTrustList(list, owner), owner)).toEqual(list);
  });

  it("does not show its content to the site", async () => {
    const owner = await generateKeyPair();
    const list = await sampleList();
    const locked = fromBase64Url(await lockTrustList(list, owner));
    const text = new TextDecoder("latin1").decode(locked);
    expect(text).not.toContain("space-s5-ad2");
    expect(locked).not.toEqual(fromBase64Url(await lockTrustList(list, owner)));
  });

  it("does not open with another key", async () => {
    const owner = await generateKeyPair();
    const other = await generateKeyPair();
    const locked = await lockTrustList(await sampleList(), owner);
    expect(await errorCode(unlockTrustList(locked, other))).toBe("unreadable-trust-list");
  });

  it("is refused when a single byte changed", async () => {
    const owner = await generateKeyPair();
    const bytes = fromBase64Url(await lockTrustList(await sampleList(), owner));
    for (const offset of [1, 30, bytes.length - 1]) {
      const changed = bytes.slice();
      changed[offset] = (changed[offset] ?? 0) ^ 1;
      expect(await errorCode(unlockTrustList(toBase64Url(changed), owner))).toBe("unreadable-trust-list");
    }
  });

  it("cannot be forged by the site, even knowing the owner's public key", async () => {
    // The site knows the public key and the format: it encrypts its own list with what it can derive from them.
    const owner = await generateKeyPair();
    const sodium = await loadSodium();
    const guessedKey = sodium.crypto_generichash(32, fromBase64Url(owner.publicKey), null);
    const nonce = sodium.randombytes_buf(24);
    const forged = concat(
      new Uint8Array([1]),
      nonce,
      sodium.crypto_aead_xchacha20poly1305_ietf_encrypt('{"spaces":[]}', new Uint8Array([1]), null, nonce, guessedKey),
    );
    expect(await errorCode(unlockTrustList(toBase64Url(forged), owner))).toBe("unreadable-trust-list");
  });

  it("refuses a newer format and a truncated blob", async () => {
    const owner = await generateKeyPair();
    const bytes = fromBase64Url(await lockTrustList(await sampleList(), owner));
    const newer = bytes.slice();
    newer[0] = 2;
    expect(await errorCode(unlockTrustList(toBase64Url(newer), owner))).toBe("unsupported-format");
    expect(await errorCode(unlockTrustList(toBase64Url(bytes.subarray(0, 40)), owner))).toBe("malformed");
  });

  it("refuses to lock a list that is not one", async () => {
    const owner = await generateKeyPair();
    const bad = { spaces: [{ spaceId: "", verified: [], certificates: [] }] };
    expect(await errorCode(lockTrustList(bad, owner))).toBe("malformed");
    const badRole = {
      spaces: [
        { spaceId: "s", verified: [{ publicKey: owner.publicKey, role: "boss", verifiedAt: 1 }], certificates: [] },
      ],
    } as unknown as TrustList;
    expect(await errorCode(lockTrustList(badRole, owner))).toBe("malformed");
  });
});
