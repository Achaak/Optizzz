// Against a real database (TEST_DATABASE_URL, migrations applied): the local Docker one, or CI's. Skipped without it.
import type { Player } from "@optizzz/game/exports";
import { PrismaPg } from "@prisma/adapter-pg";
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "~/generated/prisma/client";
import { columnDay } from "./days";
import { storeNight } from "./ingest";

const url = process.env.TEST_DATABASE_URL;

const player = (id: number, field: number, alliance: string | null = null, buildingScore = 1): Player => ({
  id,
  pseudo: `Player${String(id)}`,
  alliance,
  masterPlayerId: null,
  x: id,
  y: id,
  field,
  grade: null,
  buildingScore,
  technologyScore: 1,
  trophyScore: 1,
  onHoliday: false,
  isBanned: false,
});

// The tests build on each other: each night starts from what the previous one stored.
describe.skipIf(!url)("a night's player rows on Postgres", () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url ?? "" }) });
  const server = `t${randomUUID().slice(0, 6)}`;
  const rows = async () =>
    (await db.playerDay.findMany({ where: { server }, orderBy: [{ playerId: "asc" }, { day: "asc" }] })).map((row) => ({
      id: row.playerId,
      day: columnDay(row.day),
      until: row.until && columnDay(row.until),
      field: row.field,
      alliance: row.alliance,
    }));
  const nights = async () =>
    (await db.serverDay.findMany({ where: { server }, orderBy: { day: "asc" } })).map((row) => ({
      day: columnDay(row.day),
      players: row.players,
      field: row.field,
    }));

  afterAll(async () => {
    await db.playerDay.deleteMany({ where: { server } });
    await db.serverDay.deleteMany({ where: { server } });
    await db.$disconnect();
  });

  it("stores every player of the first night, and the night itself", async () => {
    await storeNight(db, server, "2026-11-01", [player(1, 10), player(2, 20), player(3, 30)], 2);
    expect(await rows()).toEqual([
      { id: 1, day: "2026-11-01", until: null, field: 10, alliance: null },
      { id: 2, day: "2026-11-01", until: null, field: 20, alliance: null },
      { id: 3, day: "2026-11-01", until: null, field: 30, alliance: null },
    ]);
    expect(await nights()).toEqual([{ day: "2026-11-01", players: 3, field: 60 }]);
  });

  it("adds a row only for what changed, and closes the rows no longer true", async () => {
    // 1 unchanged, 2 joins an alliance, 3 is gone, 4 is new.
    await storeNight(db, server, "2026-11-02", [player(1, 10), player(2, 20, "AAA"), player(4, 40)], 2);
    expect(await rows()).toEqual([
      { id: 1, day: "2026-11-01", until: null, field: 10, alliance: null },
      { id: 2, day: "2026-11-01", until: "2026-11-02", field: 20, alliance: null },
      { id: 2, day: "2026-11-02", until: null, field: 20, alliance: "AAA" },
      { id: 3, day: "2026-11-01", until: "2026-11-02", field: 30, alliance: null },
      { id: 4, day: "2026-11-02", until: null, field: 40, alliance: null },
    ]);
    expect((await nights()).at(-1)).toEqual({ day: "2026-11-02", players: 3, field: 70 });
  });

  it("starts a new row for a player back in the export", async () => {
    await storeNight(db, server, "2026-11-03", [player(1, 10), player(2, 20, "AAA"), player(3, 30), player(4, 40)], 2);
    expect((await rows()).filter((row) => row.id === 3)).toEqual([
      { id: 3, day: "2026-11-01", until: "2026-11-02", field: 30, alliance: null },
      { id: 3, day: "2026-11-03", until: null, field: 30, alliance: null },
    ]);
  });

  it("leaves nothing of a night whose write fails half-way", async () => {
    const before = await rows();
    // The last player, in the second chunk, does not fit a 32-bit integer: the first chunk must not stay.
    await expect(
      storeNight(db, server, "2026-11-04", [player(1, 11), player(2, 20, "AAA"), player(4, 40, null, 2 ** 40)], 2),
    ).rejects.toThrow();
    expect(await rows()).toEqual(before);
    expect((await nights()).map((night) => night.day)).toEqual(["2026-11-01", "2026-11-02", "2026-11-03"]);
  });

  it("refuses a night not after the latest stored", async () => {
    await expect(storeNight(db, server, "2026-11-02", [player(1, 10)], 2)).rejects.toThrow(/after/);
  });
});
