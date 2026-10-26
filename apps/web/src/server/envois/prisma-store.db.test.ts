// Against a real database (TEST_DATABASE_URL, migrations applied): the local Docker one, or CI's. Skipped without it.
import { createAllianceKeyring } from "@optizzz/crypto/alliance-key";
import { encryptData } from "@optizzz/crypto/data";
import { PrismaPg } from "@prisma/adapter-pg";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "~/generated/prisma/client";
import { envoiService } from "./envoi-service";
import { prismaEnvoiStore } from "./prisma-store";

const url = process.env.TEST_DATABASE_URL;
const DAY = 24 * 3600_000;

describe.skipIf(!url)("the Envois' store on Postgres", () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url ?? "" }) });
  let now = new Date();
  const service = envoiService(prismaEnvoiStore(db), () => now);
  const run = randomUUID();
  const spaceId = randomUUID();
  const base = 2_000_000_000 + Math.floor(Math.random() * 1_000_000);
  const people = ["a", "b"].map((name, index) => ({
    userId: `test-${run}-${name}`,
    playerId: base + index,
    pseudo: `test-${run}-${String(index)}`,
  }));
  const [a, b] = people as [(typeof people)[0], (typeof people)[0]];
  const fp = (n: number) => `fp${run.replace(/-/g, "").slice(0, 16)}${String(n).padStart(4, "0")}`;

  beforeAll(async () => {
    for (const person of people) {
      await db.user.create({ data: { id: person.userId, name: "", email: `${person.userId}@example.test` } });
      await db.declaredPlayer.create({
        data: { userId: person.userId, server: "s5", playerId: person.playerId, pseudo: person.pseudo },
      });
    }
    await db.space.create({
      data: {
        id: spaceId,
        server: "s5",
        tag: `T${run.slice(0, 6)}`,
        name: "Test",
        keyVersions: { create: { version: 1, createdByPseudo: a.pseudo } },
        members: {
          create: people.map((p, index) => ({
            server: "s5",
            playerId: p.playerId,
            role: index === 0 ? ("admin" as const) : ("member" as const),
            publicKey: `key-${String(index)}`,
          })),
        },
      },
    });
  });

  afterAll(async () => {
    await db.space.deleteMany({ where: { id: spaceId } });
    await db.user.deleteMany({ where: { id: { in: people.map((p) => p.userId) } } });
    await db.$disconnect();
  });

  it("keeps a Joueur's encrypted convoys, rewrites only what changed, and gives a relève what moved", async () => {
    const keyring = await createAllianceKeyring();
    const item = async (n: number, text = "convoi") => ({
      fingerprint: fp(n),
      blob: await encryptData(text, keyring),
      expiresAt: now.getTime() + 90 * DAY,
    });
    for (const p of people)
      await service.saveSettings(p.userId, { server: "s5", playerId: p.playerId, categories: ["convoys"] });
    const send = (who: typeof a, items: unknown[], removed: string[] = []) =>
      service.saveEnvoi(who.userId, {
        server: "s5",
        playerId: who.playerId,
        category: "convoys",
        keyVersion: 1,
        items,
        removed,
      });

    const one = await item(1);
    await Promise.all([send(a, [one, await item(2)]), send(a, [one])]);
    await send(b, [await item(1)]);
    const first = await service.readEnvois(b.userId, { spaceId });
    expect(first.items.map((r) => [r.playerId, r.fingerprint]).sort()).toEqual(
      [
        [a.playerId, fp(1)],
        [a.playerId, fp(2)],
        [b.playerId, fp(1)],
      ].sort(),
    );

    now = new Date(now.getTime() + 60_000);
    await send(a, [one, await item(2, "changé"), await item(3)], [fp(9)]);
    now = new Date(now.getTime() + 60_000);
    const later = await service.readEnvois(b.userId, { spaceId, since: first.cursor + 30_000 });
    expect(later.items.map((r) => r.fingerprint).sort()).toEqual([fp(2), fp(3)]);
    expect(later.live).toHaveLength(4);

    await send(a, [], [fp(3)]);
    expect((await service.readEnvois(a.userId, { spaceId })).items).toHaveLength(3);

    const spaces = await service.spacesOf(a.userId);
    expect(spaces.players[0]?.space?.version).toMatchObject({ version: 1, createdByPseudo: a.pseudo });
    expect(spaces.players[0]?.space?.members.map((m) => m.categories)).toEqual([["convoys"], ["convoys"]]);
  });

  it("keeps a flood's army apart, rewrites it when it alone changes, and hands it to the Admins only", async () => {
    const keyring = await createAllianceKeyring();
    await service.saveSettings(b.userId, { server: "s5", playerId: b.playerId, categories: ["convoys", "floods"] });
    const flood = async (army: string) => ({
      fingerprint: fp(50),
      blob: await encryptData("flood", keyring),
      detail: await encryptData(army, keyring),
      expiresAt: now.getTime() + 2 * DAY,
    });
    const send = (item: unknown) =>
      service.saveEnvoi(b.userId, {
        server: "s5",
        playerId: b.playerId,
        category: "floods",
        keyVersion: 1,
        items: [item],
        removed: [],
      });
    const first = await flood("100 JSN");
    await send(first);
    now = new Date(now.getTime() + 60_000);
    const changed = { ...first, detail: await encryptData("200 JSN", keyring) };
    await send(changed);
    const floodOf = (read: Awaited<ReturnType<typeof service.readEnvois>>) =>
      read.items.find((r) => r.category === "floods");
    // a is the space's Admin, b a member.
    expect(floodOf(await service.readEnvois(a.userId, { spaceId }))?.detail).toBe(changed.detail);
    expect(floodOf(await service.readEnvois(b.userId, { spaceId }))?.detail).toBeNull();
    const row = await db.envoiItem.findFirst({ where: { spaceId, category: "floods" } });
    expect(row?.updatedAt).toEqual(now);
    await db.envoiItem.deleteMany({ where: { spaceId, category: "floods" } });
  });

  it("erases a Joueur's Envois and settings with their account", async () => {
    await db.user.delete({ where: { id: a.userId } });
    const left = await db.envoiItem.findMany({ where: { spaceId } });
    expect(left.every((r) => r.playerId === b.playerId)).toBe(true);
    expect(left).toHaveLength(1);
    expect(await db.envoiSettings.count({ where: { playerId: a.playerId } })).toBe(0);
  });
});
