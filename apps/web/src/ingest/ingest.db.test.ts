// Against a real database (TEST_DATABASE_URL, migrations applied): the local Docker one, or CI's. Skipped without it.
import { PrismaPg } from "@prisma/adapter-pg";
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "~/generated/prisma/client";
import { storePlayerDays } from "./ingest";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("a day's player rows on Postgres", () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url ?? "" }) });
  const server = `t${randomUUID().slice(0, 6)}`;
  const row = (playerId: number, buildingScore = 1) => ({
    server,
    playerId,
    day: new Date("2026-11-01T00:00:00Z"),
    alliance: null,
    field: 10,
    buildingScore,
    technologyScore: 1,
    trophyScore: 1,
  });

  afterAll(async () => {
    await db.playerDay.deleteMany({ where: { server } });
    await db.$disconnect();
  });

  it("stores every row of a day", async () => {
    await storePlayerDays(db, [row(1), row(2), row(3)], 2);
    expect(await db.playerDay.count({ where: { server } })).toBe(3);
  });

  it("leaves no row of a day whose write fails half-way", async () => {
    await db.playerDay.deleteMany({ where: { server } });
    // The third row, in the second chunk, does not fit a 32-bit integer: the first chunk must not stay.
    await expect(storePlayerDays(db, [row(1), row(2), row(3, 2 ** 40)], 2)).rejects.toThrow();
    expect(await db.playerDay.count({ where: { server } })).toBe(0);
  });
});
