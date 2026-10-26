import { describe, expect, it } from "vitest";
import { createAllianceKeyring, rotateAllianceKey } from "./alliance-key";
import { dataKeyVersion, decryptData, encryptData } from "./data";
import { fromBase64Url, toBase64Url } from "./encoding";
import { CryptoError } from "./errors";

async function failure(promise: Promise<unknown>) {
  const error: unknown = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(CryptoError);
  return error as CryptoError;
}

const ARMY = JSON.stringify({ player: "Pseudo", units: { JSN: 12_348 }, note: "Convoi à 13 h 36 ✓" });

describe("alliance data", () => {
  it("round-trips text, accents and emoji included", async () => {
    const keyring = await createAllianceKeyring();
    const blob = await encryptData(ARMY, keyring);
    expect(blob).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(await decryptData(blob, keyring)).toBe(ARMY);
    expect(await decryptData(await encryptData("", keyring), keyring)).toBe("");
  });

  it("uses a fresh nonce each time", async () => {
    const keyring = await createAllianceKeyring();
    expect(await encryptData(ARMY, keyring)).not.toBe(await encryptData(ARMY, keyring));
  });

  it("writes the format and the key version in clear (format 1)", async () => {
    const keyring = await rotateAllianceKey(await createAllianceKeyring());
    const bytes = fromBase64Url(await encryptData("x", keyring));
    expect(bytes[0]).toBe(1);
    expect(new DataView(bytes.buffer, bytes.byteOffset).getUint32(1)).toBe(2);
    expect(bytes).toHaveLength(1 + 4 + 24 + 1 + 16);
  });

  it("fails with another alliance's key", async () => {
    const ours = await createAllianceKeyring();
    const theirs = await createAllianceKeyring();
    const error = await failure(decryptData(await encryptData(ARMY, ours), theirs));
    expect(error.code).toBe("undecryptable");
    expect(error.message).toBe(
      "Cette donnée ne se déchiffre pas : elle a été altérée, ou la Clé d'alliance ne correspond pas.",
    );
  });

  it("detects altered data, nonce or key version", async () => {
    const keyring = await rotateAllianceKey(await createAllianceKeyring());
    const bytes = fromBase64Url(await encryptData(ARMY, keyring));

    const body = bytes.slice();
    body[body.length - 5] = (body[body.length - 5] ?? 0) ^ 1;
    expect((await failure(decryptData(toBase64Url(body), keyring))).code).toBe("undecryptable");

    const nonce = bytes.slice();
    nonce[10] = (nonce[10] ?? 0) ^ 1;
    expect((await failure(decryptData(toBase64Url(nonce), keyring))).code).toBe("undecryptable");

    // Version 2 → 1: the old key exists, but the version is authenticated.
    const version = bytes.slice();
    version[4] = 1;
    expect((await failure(decryptData(toBase64Url(version), keyring))).code).toBe("undecryptable");

    expect((await failure(decryptData(toBase64Url(bytes.slice(0, 20)), keyring))).code).toBe("malformed");
  });

  it("refuses a format it does not know", async () => {
    const keyring = await createAllianceKeyring();
    const bytes = fromBase64Url(await encryptData(ARMY, keyring));
    bytes[0] = 2;
    const error = await failure(decryptData(toBase64Url(bytes), keyring));
    expect(error.code).toBe("unsupported-format");
  });

  it("reads old data after a key change, and writes with the newest key", async () => {
    const before = await createAllianceKeyring();
    const old = await encryptData("convoi d'avant l'exclusion", before);

    const after = await rotateAllianceKey(before);
    expect(await decryptData(old, after)).toBe("convoi d'avant l'exclusion");

    const fresh = await encryptData("convoi d'après", after);
    expect(new DataView(fromBase64Url(fresh).buffer).getUint32(1)).toBe(2);

    // An excluded member kept only version 1: the new data stays closed to them.
    const error = await failure(decryptData(fresh, before));
    expect(error.code).toBe("missing-key-version");
    expect(error.message).toBe(
      "Il vous manque la version 2 de la Clé d'alliance : demandez à un Admin de vous la renvoyer.",
    );
  });

  it("refuses to encrypt without a key", async () => {
    expect((await failure(encryptData(ARMY, []))).code).toBe("missing-key-version");
  });
});

describe("dataKeyVersion", () => {
  it("reads the version a datum names in clear, without any key", async () => {
    const keyring = await rotateAllianceKey(await createAllianceKeyring());
    expect(dataKeyVersion(await encryptData(ARMY, keyring))).toBe(2);
  });

  it("is null for what is not format 1, or too short", () => {
    expect(dataKeyVersion(toBase64Url(new Uint8Array([2, 0, 0, 0, 1])))).toBeNull();
    expect(dataKeyVersion(toBase64Url(new Uint8Array([1, 0, 0])))).toBeNull();
    expect(dataKeyVersion("!!")).toBeNull();
  });
});
