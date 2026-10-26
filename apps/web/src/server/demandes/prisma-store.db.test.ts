// Against a real database (TEST_DATABASE_URL, migrations applied): the local Docker one, or CI's. Skipped without it.
import { createAllianceKeyring } from "@optizzz/crypto/alliance-key";
import { encryptData } from "@optizzz/crypto/data";
import { PrismaPg } from "@prisma/adapter-pg";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "~/generated/prisma/client";
import { envoiService } from "~/server/envois/envoi-service";
import { prismaEnvoiStore } from "~/server/envois/prisma-store";
import { demandeService } from "./demande-service";
import { prismaDemandeStore } from "./prisma-store";

const url = process.env.TEST_DATABASE_URL;
const DAY = 24 * 3600_000;

describe.skipIf(!url)("the Demandes' store on Postgres", () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url ?? "" }) });
  let now = new Date();
  const service = demandeService(prismaDemandeStore(db), () => now);
  const envois = envoiService(prismaEnvoiStore(db), () => now);
  const run = randomUUID();
  const spaceId = randomUUID();
  const base = 2_100_000_000 + Math.floor(Math.random() * 1_000_000);
  const people = ["admin", "member"].map((name, index) => ({
    userId: `test-${run}-${name}`,
    playerId: base + index,
    pseudo: `test-${run}-${String(index)}`,
  }));
  const [admin, member] = people as [(typeof people)[0], (typeof people)[0]];

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
        keyVersions: { create: { version: 1, createdByPseudo: admin.pseudo } },
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
    for (const p of people)
      await envois.saveSettings(p.userId, {
        server: "s5",
        playerId: p.playerId,
        categories: ["production", "convoys"],
      });
  });

  afterAll(async () => {
    await db.space.deleteMany({ where: { id: spaceId } });
    await db.user.deleteMany({ where: { id: { in: people.map((p) => p.userId) } } });
    await db.$disconnect();
  });

  it("keeps the whole cycle of a Demande, encrypted, and forgets it 90 days after it ends", async () => {
    const keyring = await createAllianceKeyring();
    const ids = [randomUUID(), randomUUID()];
    for (const id of ids)
      await service.create(member.userId, {
        server: "s5",
        playerId: member.playerId,
        id,
        blob: await encryptData("Champignonnière 12", keyring),
        keyVersion: 1,
      });
    await service.reorder(member.userId, { server: "s5", playerId: member.playerId, ids: [...ids].reverse() });
    await service.decide(admin.userId, { id: ids[0], decision: "validated" });
    // Two validators at once: the second changes nothing.
    await expect(service.decide(admin.userId, { id: ids[0], decision: "refused" })).rejects.toThrow("a changé");
    expect(await service.close(member.userId, { server: "s5", playerId: member.playerId, ids })).toEqual({
      closed: ids,
    });

    const page = await service.read(admin.userId, { spaceId, scope: "page" });
    expect(page.demandes.map((d) => [d.id, d.status, d.rank, d.decidedByPseudo])).toEqual([
      [ids[1], "closed", 0, null],
      [ids[0], "closed", 1, admin.pseudo],
    ]);
    const stored = await db.demande.findMany({ where: { spaceId } });
    expect(stored.every((row) => !row.blob.includes("Champignonnière"))).toBe(true);

    now = new Date(now.getTime() + 91 * DAY);
    expect((await service.read(admin.userId, { spaceId, scope: "page" })).demandes).toEqual([]);
  });

  it("goes with the account of its requester", async () => {
    const keyring = await createAllianceKeyring();
    const id = randomUUID();
    await service.create(admin.userId, {
      server: "s5",
      playerId: admin.playerId,
      id,
      blob: await encryptData("Dôme 3", keyring),
      keyVersion: 1,
    });
    await db.user.delete({ where: { id: admin.userId } });
    expect(await db.demande.findUnique({ where: { id } })).toBeNull();
  });
});
