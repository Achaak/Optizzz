// Against a real database (TEST_DATABASE_URL, migrations applied): the local Docker one, or CI's. Skipped without it.
import { signCertificate } from "@optizzz/crypto/certificate";
import { generateKeyPair, type KeyPair } from "@optizzz/crypto/personal-key";
import { PrismaPg } from "@prisma/adapter-pg";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "~/generated/prisma/client";
import { excludeMember, grantAccess, newSpace, openSpace } from "~/lib/spaces/access";
import { adminMemberships, deleteLonelySpaces, prismaSpaceStore } from "./prisma-store";
import { spaceService } from "./space-service";

const url = process.env.TEST_DATABASE_URL;
const LOCKED = "A".repeat(130);

describe.skipIf(!url)("the Alliance Spaces' store on Postgres", () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url ?? "" }) });
  const service = spaceService(prismaSpaceStore(db));
  const run = randomUUID();
  const tag = `T${run.slice(0, 6)}`;
  // Export players no real server has: ids are far below this.
  const base = 2_000_000_000 + Math.floor(Math.random() * 1_000_000);
  const people = ["a", "b", "c"].map((name, index) => ({ userId: `test-${run}-${name}`, playerId: base + index }));
  const pairs: KeyPair[] = [];
  const spaceId = randomUUID();

  beforeAll(async () => {
    for (const [index, person] of people.entries()) {
      await db.player.create({
        data: {
          server: "s5",
          id: person.playerId,
          pseudo: `test-${run}-${String(index)}`,
          alliance: tag,
          masterId: null,
          x: 0,
          y: 0,
          field: 0,
          grade: null,
          buildingScore: 0,
          technologyScore: 0,
          trophyScore: 0,
          onHoliday: false,
          isBanned: false,
        },
      });
      await db.user.create({ data: { id: person.userId, name: "", email: `${person.userId}@example.test` } });
      await db.declaredPlayer.create({
        data: {
          userId: person.userId,
          server: "s5",
          playerId: person.playerId,
          pseudo: `test-${run}-${String(index)}`,
        },
      });
      const pair = await generateKeyPair();
      pairs.push(pair);
      await service.createKey(person.userId, { publicKey: pair.publicKey, lockedPrivateKey: LOCKED });
    }
  });

  afterAll(async () => {
    await db.space.deleteMany({ where: { tag } });
    await db.user.deleteMany({ where: { id: { in: people.map((p) => p.userId) } } });
    await db.player.deleteMany({ where: { server: "s5", id: { in: people.map((p) => p.playerId) } } });
    await db.$disconnect();
  });

  const [a, b, c] = people as [(typeof people)[0], (typeof people)[0], (typeof people)[0]];
  const member = async (userId: string) => {
    const view = await service.view(userId, spaceId);
    if (view.kind !== "member") throw new Error("not a member");
    return view;
  };

  it("creates a space, takes a request and gives the access, all in the accounts schema", async () => {
    const [pa, pb, pc] = pairs as [KeyPair, KeyPair, KeyPair];
    const { sealed, root } = await newSpace(pa, spaceId, Date.now());
    await service.createSpace(a.userId, { id: spaceId, server: "s5", playerId: a.playerId, sealed });
    const trust = {
      spaceId,
      verified: [root, { publicKey: pb.publicKey, role: "member" as const, verifiedAt: Date.now() }],
      certificates: [],
    };
    for (const [person, pair] of [
      [b, pb],
      [c, pc],
    ] as const) {
      await service.requestToJoin(person.userId, { spaceId, playerId: person.playerId });
      const view = await member(a.userId);
      const request = view.requests.find((r) => r.playerId === person.playerId);
      if (!request) throw new Error("no request");
      const keyring = await openSpace(pa, view.sealed, trust);
      const granted = await grantAccess({ me: pa, keyring, recipient: pair.publicKey, trust, now: Date.now() });
      await service.approve(a.userId, { spaceId, requestId: request.id, publicKey: pair.publicKey, ...granted });
    }
    const view = await member(c.userId);
    expect(view.members.map((m) => m.role)).toEqual(["admin", "member", "member"]);
    expect(view.sealed.map((s) => s.version)).toEqual([1]);
    expect(view.certificates).toHaveLength(2);
    expect(await db.joinRequest.count({ where: { spaceId } })).toBe(0);
  });

  it("never leaves the space without an Admin, even when two Admins withdraw each other at once", async () => {
    const [pa, pb] = pairs as [KeyPair, KeyPair];
    const admin = await signCertificate({ kind: "admin", spaceId, subject: pb.publicKey, admin: pa });
    await service.setRole(a.userId, { spaceId, playerId: b.playerId, role: "admin", certificate: admin });
    const later = Date.now() + 10;
    const [byA, byB] = await Promise.all([
      signCertificate({ kind: "admin-revocation", spaceId, subject: pb.publicKey, admin: pa, issuedAt: later }),
      signCertificate({ kind: "admin-revocation", spaceId, subject: pa.publicKey, admin: pb, issuedAt: later }),
    ]);
    const results = await Promise.allSettled([
      service.setRole(a.userId, { spaceId, playerId: b.playerId, role: "member", certificate: byA }),
      service.setRole(b.userId, { spaceId, playerId: a.playerId, role: "member", certificate: byB }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual(["fulfilled", "rejected"]);
    expect((await member(c.userId)).members.filter((m) => m.role === "admin")).toHaveLength(1);
  });

  it("makes a forgotten passphrase « clé à renvoyer », its boxes gone and its old key kept", async () => {
    const fresh = await generateKeyPair();
    await service.forgetPassphrase(c.userId, { publicKey: fresh.publicKey, lockedPrivateKey: LOCKED });
    const view = await member(c.userId);
    expect(view.me.keyStatus).toBe("resend");
    expect(view.sealed).toEqual([]);
    const row = await db.spaceMember.findUniqueOrThrow({
      where: { server_playerId: { server: "s5", playerId: c.playerId } },
    });
    expect(row.publicKey).toBe(pairs[2]?.publicKey);
  });

  it("blocks the last Admin's deletion, and takes a space where the account is alone with it", async () => {
    const adminUser = (await member(c.userId)).members.find((m) => m.role === "admin");
    const owner = adminUser?.playerId === a.playerId ? a : b;
    expect(await adminMemberships(db, owner.userId)).toEqual([
      { spaceName: `${tag} sur S5`, role: "admin", admins: 1, members: 3 },
    ]);
    await deleteLonelySpaces(db, owner.userId);
    expect(await db.space.count({ where: { id: spaceId } })).toBe(1);
    for (const person of people.filter((p) => p !== owner)) await service.leave(person.userId, { spaceId });
    await deleteLonelySpaces(db, owner.userId);
    expect(await db.space.count({ where: { id: spaceId } })).toBe(0);
  });
});

describe.skipIf(!url)("member departures on Postgres", () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url ?? "" }) });
  const service = spaceService(prismaSpaceStore(db));
  const run = randomUUID();
  const tag = `D${run.slice(0, 6)}`;
  const base = 2_000_000_000 + Math.floor(Math.random() * 1_000_000);
  const people = ["a", "b", "c", "d"].map((name, index) => ({
    userId: `test-${run}-${name}`,
    playerId: base + index,
    pseudo: `test-${run}-${String(index)}`,
  }));
  const pairs: KeyPair[] = [];
  const spaceId = randomUUID();
  const now = Date.now();
  const [a, b, c, d] = people as [(typeof people)[0], (typeof people)[0], (typeof people)[0], (typeof people)[0]];

  const member = async (userId: string) => {
    const view = await service.view(userId, spaceId);
    if (view.kind !== "member") throw new Error("not a member");
    return view;
  };

  beforeAll(async () => {
    for (const person of people) {
      await db.player.create({
        data: {
          server: "s5",
          id: person.playerId,
          pseudo: person.pseudo,
          alliance: tag,
          masterId: null,
          x: 0,
          y: 0,
          field: 0,
          grade: null,
          buildingScore: 0,
          technologyScore: 0,
          trophyScore: 0,
          onHoliday: false,
          isBanned: false,
        },
      });
      await db.user.create({ data: { id: person.userId, name: "", email: `${person.userId}@example.test` } });
      await db.declaredPlayer.create({
        data: { userId: person.userId, server: "s5", playerId: person.playerId, pseudo: person.pseudo },
      });
      const pair = await generateKeyPair();
      pairs.push(pair);
      await service.createKey(person.userId, { publicKey: pair.publicKey, lockedPrivateKey: LOCKED });
    }
    // A creates the space and lets B, C and D in; B is named Admin.
    const [pa, pb] = pairs as [KeyPair, KeyPair];
    const { sealed, root } = await newSpace(pa, spaceId, now);
    await service.createSpace(a.userId, { id: spaceId, server: "s5", playerId: a.playerId, sealed });
    const trust = { spaceId, verified: [root], certificates: [] };
    for (const [index, person] of [b, c, d].entries()) {
      const pair = pairs[index + 1];
      if (!pair) throw new Error("no pair");
      await service.requestToJoin(person.userId, { spaceId, playerId: person.playerId });
      const request = (await member(a.userId)).requests.find((r) => r.playerId === person.playerId);
      if (!request) throw new Error("no request");
      const keyring = await openSpace(pa, (await member(a.userId)).sealed, trust);
      const granted = await grantAccess({ me: pa, keyring, recipient: pair.publicKey, trust, now: now + 1 });
      await service.approve(a.userId, { spaceId, requestId: request.id, publicKey: pair.publicKey, ...granted });
    }
    const admin = await signCertificate({
      kind: "admin",
      spaceId,
      subject: pb.publicKey,
      admin: pa,
      issuedAt: now + 2,
    });
    await service.setRole(a.userId, { spaceId, playerId: b.playerId, role: "admin", certificate: admin });
  });

  afterAll(async () => {
    await db.space.deleteMany({ where: { tag } });
    await db.user.deleteMany({ where: { id: { in: people.map((p) => p.userId) } } });
    await db.player.deleteMany({ where: { server: "s5", id: { in: people.map((p) => p.playerId) } } });
    await db.$disconnect();
  });

  /** What an Admin's browser sends to exclude someone, from the space as the site shows it now. */
  async function prepare(admin: KeyPair, adminRoot: KeyPair, targetIndex: number) {
    const view = await member(people[pairs.indexOf(admin)]?.userId ?? "");
    const trust = {
      spaceId,
      verified: [{ publicKey: adminRoot.publicKey, role: "admin" as const, verifiedAt: now }],
      certificates: view.certificates,
    };
    const target = people[targetIndex];
    const subject = pairs[targetIndex];
    if (!target || !subject) throw new Error("no target");
    const prepared = await excludeMember({
      me: admin,
      keyring: await openSpace(admin, view.sealed, trust),
      subject: subject.publicKey,
      trust,
      remaining: view.members.map((m) => ({ playerId: m.playerId, publicKey: m.sealedFor })),
      now: Date.now() + 10,
    });
    return {
      spaceId,
      playerId: target.playerId,
      exclusion: prepared.exclusion,
      certificates: prepared.resigned,
      version: prepared.version,
      sealed: prepared.sealed,
    };
  }

  it("keeps one version 2 when two Admins exclude at the same time", async () => {
    const [pa, pb] = pairs as [KeyPair, KeyPair];
    const [byA, byB] = await Promise.all([prepare(pa, pa, 2), prepare(pb, pa, 3)]);
    expect([byA.version, byB.version]).toEqual([2, 2]);
    const results = await Promise.allSettled([service.exclude(a.userId, byA), service.exclude(b.userId, byB)]);
    expect(results.map((r) => r.status).sort()).toEqual(["fulfilled", "rejected"]);
    const refused = results.find((r) => r.status === "rejected");
    expect(String(refused?.reason)).toContain("Un autre Admin vient de changer l'accès");
    expect((await db.allianceKeyVersion.findMany({ where: { spaceId } })).map((v) => v.version)).toEqual([1, 2]);
    const view = await member(a.userId);
    expect(view.versions).toEqual([1, 2]);
    expect(view.members).toHaveLength(3);
    // Each remaining member has its boxes for both versions, and the excluded one none.
    const boxes = await db.sealedAllianceKey.groupBy({ by: ["playerId"], where: { spaceId }, _count: true });
    expect(boxes.map((x) => x._count)).toEqual([2, 2, 2]);
  });

  it("refuses a second row of the same version in the database itself", async () => {
    await expect(db.allianceKeyVersion.create({ data: { spaceId, version: 2 } })).rejects.toMatchObject({
      code: "P2002",
    });
  });

  it("keeps the absence alerts with a revision, for the Admins and Délégués", async () => {
    const blob = "A".repeat(80);
    expect(await service.saveAbsenceAlerts(a.userId, { spaceId, blob, expectedRevision: 0 })).toEqual({ revision: 1 });
    const results = await Promise.allSettled([
      service.saveAbsenceAlerts(a.userId, { spaceId, blob: "B".repeat(80), expectedRevision: 1 }),
      service.saveAbsenceAlerts(b.userId, { spaceId, blob: "C".repeat(80), expectedRevision: 1 }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual(["fulfilled", "rejected"]);
    expect((await member(a.userId)).absenceAlerts?.revision).toBe(2);
    await expect(service.saveAbsenceAlerts(a.userId, { spaceId, blob, expectedRevision: 0 })).rejects.toThrow(
      "rechargez",
    );
  });
});
