import { createAllianceKeyring, openAllianceKeyring } from "@optizzz/crypto/alliance-key";
import { openCertificate, signCertificate } from "@optizzz/crypto/certificate";
import { generateKeyPair, type KeyPair } from "@optizzz/crypto/personal-key";
import { whoToTrust, type SpaceTrust } from "@optizzz/crypto/trust";
import { describe, expect, it } from "vitest";
import { nextIssuedAt, openCertificates, owedAdminCertificates, resignAfterRevocation, withdrawAdmin } from "./access";

const SPACE = "0b8f6c1e-8a51-4f77-9a2e-5d1c2b3a4f60";
const T = Date.parse("2026-10-25T10:00:00Z");

const pairs = async (n: number) => Promise.all(Array.from({ length: n }, () => generateKeyPair()));
const cert = (
  admin: KeyPair,
  kind: "member" | "admin" | "admin-revocation" | "exclusion",
  subject: KeyPair,
  issuedAt: number,
) => signCertificate({ kind, spaceId: SPACE, subject: subject.publicKey, admin, issuedAt });

describe("dating a new statement", () => {
  it("is now, or one millisecond after the latest statement about the same key", async () => {
    const [a, b] = (await pairs(2)) as [KeyPair, KeyPair];
    const empty: SpaceTrust = { spaceId: SPACE, verified: [], certificates: [] };
    expect(await nextIssuedAt(empty, b.publicKey, T)).toBe(T);
    // A revocation dated ahead of our clock: the new certificate must still come after it.
    const ahead = await cert(a, "admin-revocation", b, T + 60_000);
    const trust = { ...empty, certificates: [ahead, await cert(a, "member", b, T - 5)] };
    expect(await nextIssuedAt(trust, b.publicKey, T)).toBe(T + 60_001);
    expect(await nextIssuedAt(trust, a.publicKey, T)).toBe(T);
  });
});

describe("certificates the site serves", () => {
  it("sets apart those that do not open for the space (bad-certificate)", async () => {
    const [a, b] = (await pairs(2)) as [KeyPair, KeyPair];
    const good = await cert(a, "member", b, T);
    const elsewhere = await signCertificate({ kind: "member", spaceId: "another", subject: b.publicKey, admin: a });
    const { validBlobs, bad } = await openCertificates({
      spaceId: SPACE,
      verified: [],
      certificates: [good, elsewhere],
    });
    expect(validBlobs).toEqual([good]);
    expect(bad).toEqual([elsewhere]);
  });
});

describe("what a newly named Admin owes", () => {
  it("certifies as Admin every Admin they believe, once, so that the members they let in believe them too", async () => {
    const [creator, named, other] = (await pairs(3)) as [KeyPair, KeyPair, KeyPair];
    // `named` entered through the creator, who named `other` and then `named`.
    const trust: SpaceTrust = {
      spaceId: SPACE,
      verified: [{ publicKey: creator.publicKey, role: "admin", verifiedAt: T }],
      certificates: [
        await cert(creator, "member", named, T + 1),
        await cert(creator, "admin", other, T + 2),
        await cert(creator, "admin", named, T + 3),
      ],
    };
    const siteAdmins = [creator.publicKey, other.publicKey, named.publicKey];
    const owed = await owedAdminCertificates({ me: named, trust, siteAdmins, now: T + 10 });
    const opened = await Promise.all(owed.map((c) => openCertificate(c, SPACE)));
    expect(opened.map((c) => [c.kind, c.issuer, c.subject])).toEqual(
      expect.arrayContaining([
        ["admin", named.publicKey, creator.publicKey],
        ["admin", named.publicKey, other.publicKey],
      ]),
    );
    expect(opened).toHaveLength(2);
    const withOwed = { ...trust, certificates: [...trust.certificates, ...owed] };
    expect(await owedAdminCertificates({ me: named, trust: withOwed, siteAdmins, now: T + 20 })).toEqual([]);

    // A newcomer let in by `named` alone believes the other Admins.
    const newcomerTrust: SpaceTrust = {
      spaceId: SPACE,
      verified: [{ publicKey: named.publicKey, role: "admin", verifiedAt: T + 30 }],
      certificates: withOwed.certificates,
    };
    expect((await whoToTrust(newcomerTrust)).admins.sort()).toEqual(siteAdmins.sort());
  });

  it("owes nothing while one is not a believed Admin oneself", async () => {
    const [creator, member] = (await pairs(2)) as [KeyPair, KeyPair];
    const trust: SpaceTrust = {
      spaceId: SPACE,
      verified: [{ publicKey: creator.publicKey, role: "admin", verifiedAt: T }],
      certificates: [await cert(creator, "member", member, T + 1)],
    };
    expect(await owedAdminCertificates({ me: member, trust, siteAdmins: [creator.publicKey], now: T })).toEqual([]);
  });
});

describe("signing again after a revocation", () => {
  it("re-signs, in one's own name, what an excluded Admin had signed and one still believed", async () => {
    // Ticket 18 excludes; the re-signing is ready here and checked with an exclusion.
    const [creator, excluded, member, me] = (await pairs(4)) as [KeyPair, KeyPair, KeyPair, KeyPair];
    const trust: SpaceTrust = {
      spaceId: SPACE,
      verified: [{ publicKey: creator.publicKey, role: "admin", verifiedAt: T }],
      certificates: [
        await cert(creator, "admin", excluded, T + 1),
        await cert(excluded, "member", member, T + 2),
        await cert(creator, "admin", me, T + 3),
        // `excluded` named `me` too: still believed through the creator.
        await cert(excluded, "admin", me, T + 4),
      ],
    };
    const exclusion = await cert(me, "exclusion", excluded, T + 10);
    const keep = [creator.publicKey, member.publicKey, me.publicKey];
    const resigned = await resignAfterRevocation({ me, trust, revocation: exclusion, keep, now: T + 10 });
    const after = { ...trust, certificates: [...trust.certificates, exclusion, ...resigned] };
    const trusted = await whoToTrust(after);
    expect(trusted.members).toContain(member.publicKey);
    expect(trusted.members).not.toContain(excluded.publicKey);
    expect(trusted.admins.sort()).toEqual([creator.publicKey, me.publicKey].sort());
    expect((await Promise.all(resigned.map((c) => openCertificate(c, SPACE)))).map((c) => [c.kind, c.subject])).toEqual(
      [["member", member.publicKey]],
    );
  });

  it("withdraws an Admin whose clock ran ahead without losing the members they let in", async () => {
    const [creator, withdrawn, member] = (await pairs(3)) as [KeyPair, KeyPair, KeyPair];
    const trust: SpaceTrust = {
      spaceId: SPACE,
      verified: [{ publicKey: creator.publicKey, role: "admin", verifiedAt: T }],
      certificates: [
        await cert(creator, "admin", withdrawn, T + 1),
        // Signed by a clock an hour ahead: it would fall after a revocation dated now.
        await cert(withdrawn, "member", member, T + 3_600_000),
      ],
    };
    const keyring = await createAllianceKeyring();
    const { revocation, resigned, sealed } = await withdrawAdmin({
      me: creator,
      keyring,
      subject: withdrawn.publicKey,
      trust,
      remaining: [creator, withdrawn, member].map((p, i) => ({ playerId: i + 1, publicKey: p.publicKey })),
      now: T + 100,
    });
    const after = { ...trust, certificates: [...trust.certificates, revocation, ...resigned] };
    const trusted = await whoToTrust(after);
    expect(trusted.admins).toEqual([creator.publicKey]);
    expect(trusted.members).toEqual(expect.arrayContaining([member.publicKey, withdrawn.publicKey]));
    // The revocation is dated after the latest statement about the withdrawn key.
    expect((await openCertificate(revocation, SPACE)).issuedAt).toBe(T + 100);
    // Every member, the withdrawn Admin included, gets the access sealed again by the one who withdrew.
    expect(sealed.map((s) => s.playerId)).toEqual([1, 2, 3]);
    const opened = await openAllianceKeyring(
      (sealed[2]?.sealed ?? []).map((s) => s.sealed),
      { spaceId: SPACE, member, trusted: trusted.admins },
    );
    expect(opened).toEqual(keyring);
  });

  it("leaves out, at a withdrawal, a member one does not believe", async () => {
    const [creator, withdrawn, stranger] = (await pairs(3)) as [KeyPair, KeyPair, KeyPair];
    const trust: SpaceTrust = {
      spaceId: SPACE,
      verified: [{ publicKey: creator.publicKey, role: "admin", verifiedAt: T }],
      certificates: [await cert(creator, "admin", withdrawn, T + 1)],
    };
    const { sealed } = await withdrawAdmin({
      me: creator,
      keyring: await createAllianceKeyring(),
      subject: withdrawn.publicKey,
      trust,
      remaining: [creator, withdrawn, stranger].map((p, i) => ({ playerId: i + 1, publicKey: p.publicKey })),
      now: T + 100,
    });
    expect(sealed.map((s) => s.playerId)).toEqual([1, 2]);
  });
});
