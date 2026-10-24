import { describe, expect, it } from "vitest";
import { CryptoError } from "./errors";
import { changePassphrase, generateKeyPair, lockPrivateKey, unlockPrivateKey } from "./personal-key";
import { fromBase64Url, toBase64Url } from "./encoding";

const PHRASE = "abeille fourmi convoi chasse ponte";

async function expectCryptoError(promise: Promise<unknown>, code: CryptoError["code"]) {
  const error: unknown = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(CryptoError);
  expect((error as CryptoError).code).toBe(code);
}

describe("personal key pair", () => {
  it("generates a 32-byte X25519 pair with its public key in base64url", async () => {
    const pair = await generateKeyPair();
    expect(pair.privateKey).toHaveLength(32);
    expect(fromBase64Url(pair.publicKey)).toHaveLength(32);
    expect(pair.publicKey).toMatch(/^[A-Za-z0-9_-]+$/);
    expect((await generateKeyPair()).publicKey).not.toBe(pair.publicKey);
  });

  it("reopens a locked private key with its passphrase only", async () => {
    const pair = await generateKeyPair();
    const locked = await lockPrivateKey(pair, PHRASE);

    const unlocked = await unlockPrivateKey(locked, PHRASE);
    expect(unlocked.privateKey).toEqual(pair.privateKey);
    expect(unlocked.publicKey).toBe(pair.publicKey);

    await expectCryptoError(unlockPrivateKey(locked, "abeille fourmi convoi chasse pont"), "wrong-passphrase");
  });

  it("forgives what a phone keyboard adds: Unicode form, outer and doubled spaces", async () => {
    const pair = await generateKeyPair();
    const locked = await lockPrivateKey(pair, "élève château forêt œuvre âme");
    // Decomposed accents (NFD), a trailing space and a double space.
    const typed = " élève  château forêt œuvre âme ".normalize("NFD");
    expect((await unlockPrivateKey(locked, typed)).publicKey).toBe(pair.publicKey);
    // Case is kept: it is part of the secret.
    await expectCryptoError(unlockPrivateKey(locked, "Élève château forêt œuvre âme"), "wrong-passphrase");
  });

  it("refuses to lock with a passphrase under 16 characters", async () => {
    const pair = await generateKeyPair();
    await expectCryptoError(lockPrivateKey(pair, "trop courte"), "passphrase-too-short");
  });

  it("keeps the Argon2id parameters with the ciphertext (format 1)", async () => {
    const pair = await generateKeyPair();
    const bytes = fromBase64Url(await lockPrivateKey(pair, PHRASE));
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    expect(bytes[0]).toBe(1);
    expect(view.getUint32(1)).toBe(3); // opslimit
    expect(view.getUint32(5)).toBe(64 * 1024 * 1024); // memlimit
    expect(bytes).toHaveLength(1 + 4 + 4 + 16 + 24 + 32 + 16);
  });

  it("rejects a locked key whose parameters were altered", async () => {
    const pair = await generateKeyPair();
    const bytes = fromBase64Url(await lockPrivateKey(pair, PHRASE));
    const tampered = bytes.slice();
    tampered[4] = 2; // opslimit 3 → 2: a different key, and the header is authenticated
    await expectCryptoError(unlockPrivateKey(toBase64Url(tampered), PHRASE), "wrong-passphrase");
  });

  it("refuses parameters that would freeze the browser, and unknown formats", async () => {
    const pair = await generateKeyPair();
    const bytes = fromBase64Url(await lockPrivateKey(pair, PHRASE));
    const huge = bytes.slice();
    new DataView(huge.buffer).setUint32(5, 1024 * 1024 * 1024);
    await expectCryptoError(unlockPrivateKey(toBase64Url(huge), PHRASE), "malformed");

    const future = bytes.slice();
    future[0] = 2;
    await expectCryptoError(unlockPrivateKey(toBase64Url(future), PHRASE), "unsupported-format");

    await expectCryptoError(unlockPrivateKey(toBase64Url(bytes.slice(0, 40)), PHRASE), "malformed");
    await expectCryptoError(unlockPrivateKey("pas du base64 !", PHRASE), "malformed");
  });

  it("changing the passphrase re-locks the same pair", async () => {
    const pair = await generateKeyPair();
    const locked = await lockPrivateKey(pair, PHRASE);
    const relocked = await changePassphrase(locked, PHRASE, "une toute nouvelle phrase secrète");

    expect(relocked).not.toBe(locked);
    const unlocked = await unlockPrivateKey(relocked, "une toute nouvelle phrase secrète");
    expect(unlocked.publicKey).toBe(pair.publicKey);
    expect(unlocked.privateKey).toEqual(pair.privateKey);
    await expectCryptoError(unlockPrivateKey(relocked, PHRASE), "wrong-passphrase");
    await expectCryptoError(
      changePassphrase(locked, "pas la bonne phrase du tout", "autre phrase assez longue"),
      "wrong-passphrase",
    );
  });

  it("explains its errors to the player in French", async () => {
    const pair = await generateKeyPair();
    const locked = await lockPrivateKey(pair, PHRASE);
    await expect(unlockPrivateKey(locked, "une autre phrase bien longue")).rejects.toThrow(
      "Phrase de chiffrement incorrecte.",
    );
  });
});
