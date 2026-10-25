import { describe, expect, it } from "vitest";
import { createAllianceKeyring, openAllianceKey, sealAllianceKey } from "./alliance-key";
import { signCertificate, type CertificateKind } from "./certificate";
import { generateKeyPair, type KeyPair } from "./personal-key";
import { whoToTrust, type SpaceTrust, type VerifiedKey } from "./trust";

const SPACE = "space-s5-ad2";
const T0 = 1_761_400_000_000;

/** `issuer` signs `kind` about `subject`, `minutes` after T0. */
function sign(issuer: KeyPair, kind: CertificateKind, subject: KeyPair, minutes: number, spaceId = SPACE) {
  return signCertificate({ kind, spaceId, subject: subject.publicKey, admin: issuer, issuedAt: T0 + minutes * 60_000 });
}

function verified(pair: KeyPair, role: VerifiedKey["role"], minutes = 0): VerifiedKey {
  return { publicKey: pair.publicKey, role, verifiedAt: T0 + minutes * 60_000 };
}

async function trust(verifiedKeys: VerifiedKey[], certificates: readonly (Promise<string> | string)[]) {
  const space: SpaceTrust = {
    spaceId: SPACE,
    verified: verifiedKeys,
    certificates: await Promise.all(certificates.map(async (c) => c)),
  };
  return whoToTrust(space);
}

/** Four people, each with their own key pair. */
async function people(): Promise<[KeyPair, KeyPair, KeyPair, KeyPair]> {
  return Promise.all([generateKeyPair(), generateKeyPair(), generateKeyPair(), generateKeyPair()]);
}

const sorted = (...pairs: KeyPair[]) => pairs.map((p) => p.publicKey).sort();

describe("who to trust", () => {
  it("believes the Admin whose code one checked, and nobody else", async () => {
    const [admin, stranger] = await people();
    expect(await trust([verified(admin, "admin")], [])).toEqual({
      admins: sorted(admin),
      members: sorted(admin),
    });
    expect((await trust([verified(admin, "admin")], [])).members).not.toContain(stranger.publicKey);
  });

  it("gives the keys to pass to openAllianceKey", async () => {
    const [admin, member] = await people();
    const [key] = await createAllianceKeyring();
    if (!key) throw new Error("no key");
    const sealed = await sealAllianceKey(key, { spaceId: SPACE, recipient: member.publicKey, admin });
    const { admins } = await trust([verified(admin, "admin")], []);
    expect(await openAllianceKey(sealed, { spaceId: SPACE, member: member, trusted: admins })).toEqual(key);
  });

  it("believes the Admins certified, from one believed Admin to the next", async () => {
    const [a, b, c, m] = await people();
    const result = await trust(
      [verified(a, "admin")],
      [sign(a, "admin", b, 1), sign(b, "admin", c, 2), sign(c, "member", m, 3)],
    );
    expect(result.admins).toEqual(sorted(a, b, c));
    expect(result.members).toEqual(sorted(a, b, c, m));
  });

  it("believes a member a believed Admin certified, and a member one checked by code, but not as Admins", async () => {
    const [admin, certified, checked] = await people();
    const result = await trust(
      [verified(admin, "admin"), verified(checked, "member")],
      [sign(admin, "member", certified, 1)],
    );
    expect(result.admins).toEqual(sorted(admin));
    expect(result.members).toEqual(sorted(admin, certified, checked));
  });

  it("ignores what an unknown key signed, and certificates of another space", async () => {
    const [admin, stranger, member, other] = await people();
    const result = await trust(
      [verified(admin, "admin")],
      [
        sign(stranger, "admin", other, 1),
        sign(stranger, "member", member, 1),
        sign(admin, "admin", other, 1, "space-s2-ad2"),
      ],
    );
    expect(result).toEqual({ admins: sorted(admin), members: sorted(admin) });
  });

  it("does not believe a key for having certified a believed Admin", async () => {
    const [admin, stranger] = await people();
    expect(await trust([verified(admin, "admin")], [sign(stranger, "admin", admin, 1)])).toEqual({
      admins: sorted(admin),
      members: sorted(admin),
    });
  });

  it("ignores a certificate that does not open", async () => {
    const [admin] = await people();
    expect(await trust([verified(admin, "admin")], ["AAAA", "not base64 !"])).toEqual({
      admins: sorted(admin),
      members: sorted(admin),
    });
  });

  it("drops an excluded member, and an Admin whose role is withdrawn, who stays a member", async () => {
    const [a, b, m] = await people();
    const result = await trust(
      [verified(a, "admin")],
      [sign(a, "admin", b, 1), sign(a, "member", m, 1), sign(a, "admin-revocation", b, 2), sign(a, "exclusion", m, 2)],
    );
    expect(result.admins).toEqual(sorted(a));
    expect(result.members).toEqual(sorted(a, b));
  });

  it("lets a later certificate bring back a key, but not an earlier one", async () => {
    const [a, back, notBack] = await people();
    const result = await trust(
      [verified(a, "admin")],
      [
        sign(a, "member", back, 1),
        sign(a, "exclusion", back, 2),
        sign(a, "member", back, 3),
        sign(a, "member", notBack, 1),
        sign(a, "exclusion", notBack, 2),
      ],
    );
    expect(result.members).toEqual(sorted(a, back));
  });

  it("lets a revocation win over a certificate of the same millisecond", async () => {
    const [a, m] = await people();
    expect(
      (await trust([verified(a, "admin")], [sign(a, "member", m, 1), sign(a, "exclusion", m, 1)])).members,
    ).toEqual(sorted(a));
  });

  it("stops believing an Admin one checked by code once a believed Admin withdraws them", async () => {
    const [a, b] = await people();
    const result = await trust([verified(a, "admin")], [sign(a, "admin", b, 1), sign(b, "admin-revocation", a, 2)]);
    expect(result.admins).toEqual(sorted(b));
    expect(result.members).toEqual(sorted(a, b));
  });

  it("believes again an Admin whose code one checks after the revocation", async () => {
    const [a, b] = await people();
    const result = await trust([verified(a, "admin", 3)], [sign(a, "admin", b, 1), sign(b, "admin-revocation", a, 2)]);
    expect(result.admins).toEqual(sorted(a, b));
  });

  it("believes neither Admin of a crossed revocation, whatever their dates", async () => {
    const [a, b, c] = await people();
    const base = [sign(a, "admin", b, 1), sign(a, "admin", c, 1)];
    for (const [first, second] of [
      [2, 3],
      [3, 2],
    ] as const) {
      const result = await trust(
        [verified(a, "admin")],
        [...base, sign(b, "admin-revocation", c, first), sign(c, "admin-revocation", b, second)],
      );
      expect(result.admins).toEqual(sorted(a));
      expect(result.members).toEqual(sorted(a, b, c));
    }
  });

  it("lets another believed Admin settle a crossed revocation with a later certificate", async () => {
    const [a, b, c] = await people();
    const result = await trust(
      [verified(a, "admin")],
      [
        sign(a, "admin", b, 1),
        sign(a, "admin", c, 1),
        sign(b, "exclusion", c, 2),
        sign(c, "exclusion", b, 2),
        sign(a, "admin", b, 3),
      ],
    );
    expect(result.admins).toEqual(sorted(a, b));
    expect(result.members).toEqual(sorted(a, b));
  });

  it("ignores everything an excluded Admin certified, even dated before the exclusion", async () => {
    const [a, rogue, puppet, puppetMember] = await people();
    const result = await trust(
      [verified(a, "admin")],
      [
        sign(a, "admin", rogue, 1),
        sign(a, "exclusion", rogue, 5),
        // Signed after the exclusion with a date from before it: the rogue still holds the key.
        sign(rogue, "admin", puppet, 2),
        sign(rogue, "member", puppetMember, 2),
        sign(puppet, "admin", rogue, 6),
      ],
    );
    expect(result).toEqual({ admins: sorted(a), members: sorted(a) });
  });

  it("keeps what a withdrawn Admin certified before the withdrawal, not after", async () => {
    const [a, b, before, after] = await people();
    const result = await trust(
      [verified(a, "admin")],
      [
        sign(a, "admin", b, 1),
        sign(b, "member", before, 2),
        sign(a, "admin-revocation", b, 3),
        sign(b, "member", after, 4),
      ],
    );
    expect(result.admins).toEqual(sorted(a));
    expect(result.members).toEqual(sorted(a, b, before));
  });

  it("no longer believes the members only an excluded Admin certified, until another Admin certifies them", async () => {
    const [a, b, m] = await people();
    const excluded = [sign(a, "admin", b, 1), sign(b, "member", m, 2), sign(a, "exclusion", b, 3)];
    expect((await trust([verified(a, "admin")], excluded)).members).toEqual(sorted(a));
    expect((await trust([verified(a, "admin")], [...excluded, sign(a, "member", m, 3)])).members).toEqual(sorted(a, m));
  });

  it("believes nobody when the Admin one checked is excluded by an Admin they named", async () => {
    const [a, b] = await people();
    expect(await trust([verified(a, "admin")], [sign(a, "admin", b, 1), sign(b, "exclusion", a, 2)])).toEqual({
      admins: [],
      members: [],
    });
  });

  it("gives the same answer whatever the order of the certificates", async () => {
    const [a, b, c, m] = await people();
    const certificates = await Promise.all([
      sign(a, "admin", b, 1),
      sign(b, "admin", c, 2),
      sign(c, "member", m, 3),
      sign(a, "exclusion", m, 4),
      sign(b, "member", m, 5),
    ]);
    const forward = await trust([verified(a, "admin")], certificates);
    expect(await trust([verified(a, "admin")], [...certificates].reverse())).toEqual(forward);
    expect(forward.members).toEqual(sorted(a, b, c, m));
  });
});
