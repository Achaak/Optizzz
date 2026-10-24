// Against a real database (TEST_DATABASE_URL, migrations applied): the local Docker one, or CI's. Skipped without it.
import { PrismaPg } from "@prisma/adapter-pg";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "~/generated/prisma/client";
import { prismaExtensionStore } from "./prisma-store";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("the extension's store on Postgres", () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url ?? "" }) });
  const store = prismaExtensionStore(db);
  const run = randomUUID();
  // An export player no real server has: ids are far below this.
  const player = { server: "s5", id: 2_000_000_000 + Math.floor(Math.random() * 1_000_000), pseudo: `test-${run}` };
  const users = [`test-${run}-1`, `test-${run}-2`];

  beforeAll(async () => {
    await db.player.create({
      data: {
        ...player,
        alliance: null,
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
    for (const id of users) await db.user.create({ data: { id, name: "", email: `${id}@example.test` } });
  });

  afterAll(async () => {
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.player.deleteMany({ where: { server: player.server, id: player.id } });
    await db.$disconnect();
  });

  it("keeps one account per Player, even when two declare it at the same time", async () => {
    const [first, second] = users as [string, string];
    const declaration = { server: player.server, playerId: player.id, pseudo: player.pseudo };
    expect(await store.exportPlayer(player.server, player.pseudo)).toEqual({ id: player.id, pseudo: player.pseudo });
    const results = await Promise.all([
      store.declarePlayer(first, declaration),
      store.declarePlayer(second, declaration),
    ]);
    expect(results.sort()).toEqual(["declared", "taken"]);
    const owner = results[0] === "declared" ? first : second;
    expect(await store.declarePlayer(owner, declaration)).toBe("mine");
  });

  it("deleting the account takes its tokens and its Players with it", async () => {
    const owner = (
      await db.declaredPlayer.findUniqueOrThrow({
        where: { server_playerId: { server: player.server, playerId: player.id } },
      })
    ).userId;
    await store.createToken(owner, `hash-${run}`, "Chrome");
    expect(await store.userOfToken(`hash-${run}`)).toBe(owner);

    await db.user.delete({ where: { id: owner } });

    expect(await store.userOfToken(`hash-${run}`)).toBeNull();
    expect(await db.extensionToken.count({ where: { userId: owner } })).toBe(0);
    expect(await db.declaredPlayer.count({ where: { userId: owner } })).toBe(0);
    // The public export's player stays: only what the account owns goes.
    expect(await store.exportPlayer(player.server, player.pseudo)).not.toBeNull();
  });
});
