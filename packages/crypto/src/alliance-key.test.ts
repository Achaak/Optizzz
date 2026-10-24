import { describe, expect, it } from "vitest";
import {
  createAllianceKeyring,
  openAllianceKey,
  openAllianceKeyring,
  rotateAllianceKey,
  sealAllianceKey,
  sealAllianceKeyring,
  type AllianceKey,
} from "./alliance-key";
import { concat, fromBase64Url, toBase64Url, uint32 } from "./encoding";
import { CryptoError } from "./errors";
import {
  boxKeyPair,
  boxPublicKey,
  generateKeyPair,
  lockPrivateKey,
  unlockPrivateKey,
  type KeyPair,
} from "./personal-key";
import { loadSodium } from "./sodium";

async function errorCode(promise: Promise<unknown>) {
  const error: unknown = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(CryptoError);
  return (error as CryptoError).code;
}

const SPACE = "space-s5-ad2";

async function firstKey(): Promise<AllianceKey> {
  const [key] = await createAllianceKeyring();
  if (!key) throw new Error("no key");
  return key;
}

/** An Admin, a member, and the version 1 sealed and signed for that member. */
async function setup() {
  const admin = await generateKeyPair();
  const member = await generateKeyPair();
  const key = await firstKey();
  const sealed = await sealAllianceKey(key, { spaceId: SPACE, recipient: member.publicKey, admin });
  return { admin, member, key, sealed };
}

// What an attacker can do: open a box sealed for themselves (they are, or were, a member),
// change what is inside, and seal it again for anyone: sealed boxes are anonymous.
async function openBox(sealed: string, pair: KeyPair): Promise<Uint8Array> {
  const sodium = await loadSodium();
  const box = boxKeyPair(sodium, pair);
  return sodium.crypto_box_seal_open(fromBase64Url(sealed).subarray(1), box.publicKey, box.privateKey);
}

async function sealBox(plaintext: Uint8Array, publicKey: string, format = 2): Promise<string> {
  const sodium = await loadSodium();
  return toBase64Url(
    concat(new Uint8Array([format]), sodium.crypto_box_seal(plaintext, boxPublicKey(sodium, publicKey))),
  );
}

// Inside the box: [key version u32][key 32][signer public key 32][signature 64].
const KEY_OFFSET = 4;
const SIGNER_OFFSET = 36;
const SIGNATURE_OFFSET = 68;

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
  it("opens only with the recipient's private key, when signed by a trusted Admin", async () => {
    const { admin, member, key, sealed } = await setup();
    const stranger = await generateKeyPair();

    expect(await openAllianceKey(sealed, { spaceId: SPACE, member, trusted: [admin.publicKey] })).toEqual(key);
    expect(
      await errorCode(openAllianceKey(sealed, { spaceId: SPACE, member: stranger, trusted: [admin.publicKey] })),
    ).toBe("not-for-this-key");
  });

  it("writes format 2: the signature travels inside the box (181 bytes)", async () => {
    const { admin, member, key, sealed } = await setup();
    const bytes = fromBase64Url(sealed);
    expect(bytes[0]).toBe(2);
    expect(bytes).toHaveLength(1 + 48 + 4 + 32 + 32 + 64);

    const plaintext = await openBox(sealed, member);
    expect(new DataView(plaintext.buffer, plaintext.byteOffset).getUint32(0)).toBe(1);
    expect(plaintext.slice(KEY_OFFSET, SIGNER_OFFSET)).toEqual(key.key);
    expect(toBase64Url(plaintext.slice(SIGNER_OFFSET, SIGNATURE_OFFSET))).toBe(admin.publicKey);
  });

  it("detects a sealed key that was altered", async () => {
    const { admin, member, sealed } = await setup();
    const bytes = fromBase64Url(sealed);
    bytes[bytes.length - 1] = (bytes[bytes.length - 1] ?? 0) ^ 1;
    expect(
      await errorCode(openAllianceKey(toBase64Url(bytes), { spaceId: SPACE, member, trusted: [admin.publicKey] })),
    ).toBe("not-for-this-key");
  });

  it("refuses an unknown format and malformed inputs", async () => {
    const { admin, member, key, sealed } = await setup();
    const opening = { spaceId: SPACE, member, trusted: [admin.publicKey] };
    const bytes = fromBase64Url(sealed);
    bytes[0] = 9;
    expect(await errorCode(openAllianceKey(toBase64Url(bytes), opening))).toBe("unsupported-format");
    expect(await errorCode(openAllianceKey(toBase64Url(fromBase64Url(sealed).slice(0, 100)), opening))).toBe(
      "malformed",
    );

    expect(await errorCode(sealAllianceKey(key, { spaceId: SPACE, recipient: "AAAA", admin }))).toBe("malformed");
    // 32 zero bytes: a small-order point, not a public key anyone holds the private key of.
    const zeros = toBase64Url(new Uint8Array(32));
    expect(await errorCode(sealAllianceKey(key, { spaceId: SPACE, recipient: zeros, admin }))).toBe("malformed");
    expect(await errorCode(sealAllianceKey(key, { spaceId: "", recipient: member.publicKey, admin }))).toBe(
      "malformed",
    );
  });

  it("seals every version for a new member, who rebuilds the whole keyring", async () => {
    const creator = await generateKeyPair();
    const otherAdmin = await generateKeyPair();
    const newcomer = await generateKeyPair();
    const keyring = await rotateAllianceKey(await rotateAllianceKey(await createAllianceKeyring()));

    // Versions 1 and 2 sealed by the creator, version 3 by the Admin who excluded someone.
    const byCreator = await sealAllianceKeyring(keyring.slice(0, 2), {
      spaceId: SPACE,
      recipient: newcomer.publicKey,
      admin: creator,
    });
    const byOther = await sealAllianceKeyring(keyring.slice(2), {
      spaceId: SPACE,
      recipient: newcomer.publicKey,
      admin: otherAdmin,
    });
    const sealed = [...byCreator, ...byOther];
    expect(sealed.map((s) => s.version)).toEqual([1, 2, 3]);

    // The site may hand them back in any order.
    const opening = { spaceId: SPACE, member: newcomer, trusted: [creator.publicKey, otherAdmin.publicKey] };
    expect(await openAllianceKeyring(sealed.map((s) => s.sealed).reverse(), opening)).toEqual(keyring);

    // One untrusted version spoils the keyring: nothing is half-opened.
    expect(
      await errorCode(
        openAllianceKeyring(
          sealed.map((s) => s.sealed),
          { ...opening, trusted: [creator.publicKey] },
        ),
      ),
    ).toBe("untrusted-signer");
  });

  it("still opens after the member unlocks their pair elsewhere, or changes passphrase", async () => {
    const { admin, member, key, sealed } = await setup();
    const unlocked = await unlockPrivateKey(
      await lockPrivateKey(member, "abeille fourmi convoi chasse ponte"),
      "abeille fourmi convoi chasse ponte",
    );
    expect(await openAllianceKey(sealed, { spaceId: SPACE, member: unlocked, trusted: [admin.publicKey] })).toEqual(
      key,
    );
  });
});

describe("refusing a Clé d'alliance that a trusted Admin did not sign for this place", () => {
  it("refuses a key signed by someone outside the trusted list", async () => {
    const { admin, member, sealed } = await setup();
    const someoneElse = await generateKeyPair();
    expect(await errorCode(openAllianceKey(sealed, { spaceId: SPACE, member, trusted: [someoneElse.publicKey] }))).toBe(
      "untrusted-signer",
    );
    expect(await errorCode(openAllianceKey(sealed, { spaceId: SPACE, member, trusted: [] }))).toBe("untrusted-signer");

    // The signature is checked first: the error names the key that really signed, for the interface to show its
    // fingerprint.
    const error: unknown = await openAllianceKey(sealed, { spaceId: SPACE, member, trusted: [] }).catch(
      (e: unknown) => e,
    );
    expect((error as CryptoError).signer).toBe(admin.publicKey);

    // The site seals its own key and signs it with its own pair: valid, but not from anyone the member trusts.
    const site = await generateKeyPair();
    const planted = await sealAllianceKey(await firstKey(), {
      spaceId: SPACE,
      recipient: member.publicKey,
      admin: site,
    });
    expect(await errorCode(openAllianceKey(planted, { spaceId: SPACE, member, trusted: [admin.publicKey] }))).toBe(
      "untrusted-signer",
    );
  });

  it("refuses an unsigned key: format 1, or a signature left empty", async () => {
    const { admin, member, key, sealed } = await setup();
    const opening = { spaceId: SPACE, member, trusted: [admin.publicKey] };

    // Format 1 was an anonymous sealed box: [key version u32][key 32].
    const unsigned = await sealBox(concat(uint32(key.version), key.key), member.publicKey, 1);
    expect(await errorCode(openAllianceKey(unsigned, opening))).toBe("bad-signature");

    const empty = await openBox(sealed, member);
    empty.fill(0, SIGNATURE_OFFSET);
    expect(await errorCode(openAllianceKey(await sealBox(empty, member.publicKey), opening))).toBe("bad-signature");
  });

  it("refuses a signature replayed for another space", async () => {
    // One pair per Compte: the same person is in a space on S2 and one on S5, both with the same Admin.
    // The site hands them the S2 key, which S2's members know, as the S5 key.
    const admin = await generateKeyPair();
    const member = await generateKeyPair();
    const s2Key = await firstKey();
    const s2Sealed = await sealAllianceKey(s2Key, { spaceId: "space-s2", recipient: member.publicKey, admin });

    const opening = { member, trusted: [admin.publicKey] };
    expect(await openAllianceKey(s2Sealed, { ...opening, spaceId: "space-s2" })).toEqual(s2Key);
    expect(await errorCode(openAllianceKey(s2Sealed, { ...opening, spaceId: SPACE }))).toBe("bad-signature");

    // A member of the S2 space reseals what they received for someone in the S5 space.
    const insider = await generateKeyPair();
    const victim = await generateKeyPair();
    const theirs = await sealAllianceKey(s2Key, { spaceId: "space-s2", recipient: insider.publicKey, admin });
    const replayed = await sealBox(await openBox(theirs, insider), victim.publicKey);
    expect(
      await errorCode(openAllianceKey(replayed, { spaceId: SPACE, member: victim, trusted: [admin.publicKey] })),
    ).toBe("bad-signature");
  });

  it("refuses a signature replayed for another version", async () => {
    // An excluded member kept version 1, and the site passes it off as version 3, newer than what others hold.
    const { admin, member, sealed } = await setup();
    const plaintext = await openBox(sealed, member);
    plaintext.set(uint32(3), 0);
    expect(
      await errorCode(
        openAllianceKey(await sealBox(plaintext, member.publicKey), {
          spaceId: SPACE,
          member,
          trusted: [admin.publicKey],
        }),
      ),
    ).toBe("bad-signature");
  });

  it("refuses a signature replayed for another recipient", async () => {
    const { admin, member, sealed } = await setup();
    const victim = await generateKeyPair();
    const replayed = await sealBox(await openBox(sealed, member), victim.publicKey);
    expect(
      await errorCode(openAllianceKey(replayed, { spaceId: SPACE, member: victim, trusted: [admin.publicKey] })),
    ).toBe("bad-signature");
  });

  it("refuses a genuine signature over another key, or credited to another trusted Admin", async () => {
    const { admin, member, sealed } = await setup();
    const opening = { spaceId: SPACE, member, trusted: [admin.publicKey] };

    const swapped = await openBox(sealed, member);
    swapped.set((await firstKey()).key, KEY_OFFSET);
    expect(await errorCode(openAllianceKey(await sealBox(swapped, member.publicKey), opening))).toBe("bad-signature");

    const otherAdmin = await generateKeyPair();
    const credited = await openBox(sealed, member);
    credited.set(fromBase64Url(otherAdmin.publicKey), SIGNER_OFFSET);
    expect(
      await errorCode(
        openAllianceKey(await sealBox(credited, member.publicKey), {
          ...opening,
          trusted: [admin.publicKey, otherAdmin.publicKey],
        }),
      ),
    ).toBe("bad-signature");
  });

  it("explains the refusals to the player in French", async () => {
    const { member, sealed } = await setup();
    await expect(openAllianceKey(sealed, { spaceId: SPACE, member, trusted: [] })).rejects.toThrow(
      "Cette Clé d'alliance est signée par une clé que vous n'avez pas reconnue : comparez son empreinte avec celle de l'Admin avant de l'accepter.",
    );
    await expect(openAllianceKey(sealed, { spaceId: "another-space", member, trusted: [] })).rejects.toThrow(
      "Cette Clé d'alliance ne porte pas de signature valable d'un Admin de cet espace : ne l'utilisez pas, et prévenez un Admin.",
    );
  });
});
