// Against a real database (TEST_DATABASE_URL, migrations applied): the local Docker one, or CI's. Skipped without it.
import type { Player } from "@optizzz/game/exports";
import { PrismaPg } from "@prisma/adapter-pg";
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "~/generated/prisma/client";
import { storeNight } from "~/ingest/ingest";
import { playerNightRanks } from "./player-nights";

const url = process.env.TEST_DATABASE_URL;

const player = (id: number, field: number): Player => ({
  id,
  pseudo: `Player${String(id)}`,
  alliance: null,
  masterPlayerId: null,
  x: id,
  y: id,
  field,
  grade: null,
  buildingScore: 1,
  technologyScore: 1,
  trophyScore: 1,
  onHoliday: false,
  isBanned: false,
});

describe.skipIf(!url)("players' ranks night by night on Postgres", () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url ?? "" }) });
  const server = `t${randomUUID().slice(0, 6)}`;
  const ranks = async (ids: number[], since: Date | null) =>
    (await playerNightRanks(db, server, ids, since)).map(({ id, day, rank }) => ({
      id,
      day: day.toISOString().slice(0, 10),
      rank,
    }));

  afterAll(async () => {
    await db.playerDay.deleteMany({ where: { server } });
    await db.serverDay.deleteMany({ where: { server } });
    await db.$disconnect();
  });

  it("ranks from the stored rows, and reads them again once a night is added", async () => {
    await storeNight(db, server, "2026-11-01", [player(1, 10), player(2, 20), player(3, 30)]);
    await storeNight(db, server, "2026-11-02", [player(1, 40), player(2, 20), player(3, 30)]);
    expect(await ranks([1, 2], null)).toEqual([
      { id: 1, day: "2026-11-01", rank: 3 },
      { id: 2, day: "2026-11-01", rank: 2 },
      { id: 1, day: "2026-11-02", rank: 1 },
      { id: 2, day: "2026-11-02", rank: 3 },
    ]);

    await storeNight(db, server, "2026-11-03", [player(1, 40), player(2, 50)]);
    expect(await ranks([1, 2], new Date("2026-11-02T15:00:00Z"))).toEqual([
      { id: 1, day: "2026-11-02", rank: 1 },
      { id: 2, day: "2026-11-02", rank: 3 },
      { id: 1, day: "2026-11-03", rank: 2 },
      { id: 2, day: "2026-11-03", rank: 1 },
    ]);
  });
});
