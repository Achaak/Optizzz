// Against a real database (TEST_DATABASE_URL, migrations applied): the local Docker one, or CI's. Skipped without it.
import { PrismaPg } from "@prisma/adapter-pg";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "~/generated/prisma/client";
import { backfillHourly } from "./backfill";

const url = process.env.TEST_DATABASE_URL;

const server = { id: `t${randomUUID().slice(0, 6)}`, name: "Test", origin: "https://exports.test" };

const player = (id: number, field: number) => ({
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

/** What the game publishes: four hourly exports, then one three days earlier, out of the 30 days kept. */
const published: Record<string, unknown[]> = {
  "202610010000": [player(1, 1), player(2, 1)],
  "202611010000": [player(1, 100), player(2, 200)],
  // Player 1 loses 10 (10 %), player 2 in range wins them.
  "202611010100": [player(1, 90), player(2, 210)],
  "202611010200": [player(1, 90), player(2, 230)],
  // Already written by the cron's pass.
  "202611010300": [player(1, 90), player(2, 250)],
};
const requested: string[] = [];

function fakeFetch(input: string | URL | Request): Promise<Response> {
  const address = input instanceof Request ? input.url : String(input);
  requested.push(address);
  const versions = Object.keys(published).sort().reverse();
  if (address === `${server.origin}/api/exports/`)
    return Promise.resolve(Response.json({ players: versions, alliances: versions }));
  const version = /version=(\d+)$/.exec(address)?.[1];
  const players = version === undefined ? undefined : published[version];
  if (!players) throw new Error(`Unexpected address: ${address}`);
  return Promise.resolve(Response.json(players));
}

describe.skipIf(!url)("taking back the hourly moves on Postgres", () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url ?? "" }) });
  const where = { where: { server: server.id } };
  const now = new Date("2026-11-02T00:00:00Z");

  beforeAll(async () => {
    vi.stubGlobal("fetch", fakeFetch);
    // The cron already read 03:00 and wrote the hour before it.
    await db.exportRead.create({ data: { server: server.id, kind: "players", version: "202611010300" } });
    await db.playerHour.create({
      data: {
        server: server.id,
        playerId: 2,
        since: new Date("2026-11-01T02:00:00Z"),
        at: new Date("2026-11-01T03:00:00Z"),
        field: 250,
        delta: 20,
      },
    });
  });

  afterAll(async () => {
    vi.unstubAllGlobals();
    await db.exportRead.deleteMany(where);
    await db.playerHour.deleteMany(where);
    await db.probableFlood.deleteMany(where);
    await db.$disconnect();
  });

  it("writes the hours of the last 30 days the cron did not, as the cron would", async () => {
    const report = await backfillHourly(db, server, now, { pauseMs: 0 });
    expect(report).toEqual({ hours: 2, skipped: 1 });
    const hours = await db.playerHour.findMany({ ...where, orderBy: [{ at: "asc" }, { playerId: "asc" }] });
    expect(hours.map((row) => [row.at.toISOString(), row.playerId, row.delta])).toEqual([
      ["2026-11-01T01:00:00.000Z", 1, -10],
      ["2026-11-01T01:00:00.000Z", 2, 10],
      ["2026-11-01T02:00:00.000Z", 2, 20],
      ["2026-11-01T03:00:00.000Z", 2, 20],
    ]);
    expect(await db.probableFlood.findMany(where)).toMatchObject([
      { victimId: 1, amount: 10, attackers: [2], sureness: "sure" },
    ]);
    // Beyond 30 days, never asked for.
    expect(requested.some((address) => address.includes("202610010000"))).toBe(false);
  });

  it("can run again without writing anything twice", async () => {
    const report = await backfillHourly(db, server, now, { pauseMs: 0 });
    expect(report).toEqual({ hours: 0, skipped: 3 });
    expect(await db.playerHour.count(where)).toBe(4);
    expect(await db.probableFlood.count(where)).toBe(1);
  });
});
