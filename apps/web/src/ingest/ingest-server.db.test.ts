// Against a real database (TEST_DATABASE_URL, migrations applied): the local Docker one, or CI's. Skipped without it.
import { PrismaPg } from "@prisma/adapter-pg";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "~/generated/prisma/client";
import { ingestServer } from "./ingest";

const url = process.env.TEST_DATABASE_URL;

const server = { id: `t${randomUUID().slice(0, 6)}`, name: "Test", origin: "https://exports.test" };

const player = (id: number, alliance: string | null, field = 100 * id) => ({
  id,
  pseudo: `Player${String(id)}`,
  alliance,
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
const alliance = (tag: string, playersCount: number) => ({
  tag,
  name: tag,
  playersCount,
  totalField: 1,
  totalBuildingScore: 1,
  totalTechnologyScore: 1,
  totalTrophyScore: 1,
  diplomacy: { pacts: [], wars: [] },
});

/** What the game publishes: the versions (latest first) and each version's players and alliances. */
let published: Record<string, { players: unknown[]; alliances: unknown[] }> = {};
/** Every address the pass asked for, and those the fake server does not know. */
const requested: string[] = [];
const unknown: string[] = [];

/** The fake game: a thrown error would be retried for 30 seconds, so unknown addresses are also checked per test. */
function fakeFetch(input: string | URL | Request): Promise<Response> {
  const address = input instanceof Request ? input.url : String(input);
  requested.push(address);
  const versions = Object.keys(published).sort().reverse();
  if (address === `${server.origin}/api/exports/`)
    return Promise.resolve(Response.json({ players: versions, alliances: versions }));
  const match = /^https:\/\/exports\.test\/api\/exports\/(players|alliances)\/\?version=(\d+)$/.exec(address);
  const kind = match?.[1] as "players" | "alliances" | undefined;
  const version = match?.[2];
  const reading = version === undefined ? undefined : published[version];
  if (!kind || !reading) {
    unknown.push(address);
    throw new Error(`Unexpected address: ${address}`);
  }
  return Promise.resolve(Response.json(reading[kind]));
}

// The tests build on each other: each pass starts from what the previous one stored.
describe.skipIf(!url)("the cron's pass over a server on Postgres", () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url ?? "" }) });
  const where = { where: { server: server.id } };
  const counts = async () => ({
    players: await db.player.count(where),
    alliances: await db.alliance.count(where),
    journal: await db.journalEntry.count(where),
    playerDays: await db.playerDay.count(where),
    allianceDays: await db.allianceDay.count(where),
  });
  const readVersions = async () =>
    (await db.exportRead.findMany({ ...where, orderBy: { kind: "asc" } })).map((read) => [read.kind, read.version]);
  const mapVersion = async () => (await db.mapFile.findUnique({ where: { server: server.id } }))?.version;

  beforeAll(() => {
    vi.stubGlobal("fetch", fakeFetch);
  });

  afterAll(async () => {
    vi.unstubAllGlobals();
    await db.player.deleteMany(where);
    await db.alliance.deleteMany(where);
    await db.playerDay.deleteMany(where);
    await db.allianceDay.deleteMany(where);
    await db.journalEntry.deleteMany(where);
    await db.exportRead.deleteMany(where);
    await db.mapFile.deleteMany(where);
    await db.$disconnect();
  });

  it("stores the first export: players, alliances, the map and the night, without a Journal", async () => {
    published = {
      "202611010005": {
        players: [player(1, "AAA"), player(2, "AAA"), player(3, null)],
        alliances: [alliance("AAA", 2)],
      },
    };
    const report = await ingestServer(db, server, new Date("2026-11-01T02:00:00Z"));
    expect(report).toEqual({ updated: true, changes: 0, days: 1 });
    expect(await counts()).toEqual({ players: 3, alliances: 1, journal: 0, playerDays: 3, allianceDays: 1 });
    expect(await readVersions()).toEqual([
      ["alliances", "202611010005"],
      ["players", "202611010005"],
    ]);
    expect(await mapVersion()).toBe("202611010005");
    expect(unknown).toEqual([]);
  });

  it("does nothing when no newer export is published", async () => {
    const before = await counts();
    const report = await ingestServer(db, server, new Date("2026-11-01T02:00:00Z"));
    expect(report).toEqual({ updated: false, changes: 0, days: 0 });
    expect(await counts()).toEqual(before);
    expect(unknown).toEqual([]);
  });

  it("writes what changed since the last pass, and says it in the Journal", async () => {
    published["202611010105"] = {
      players: [player(1, "AAA"), player(2, null), player(4, null)],
      alliances: [alliance("AAA", 1)],
    };
    const report = await ingestServer(db, server, new Date("2026-11-01T03:00:00Z"));
    expect(report.updated).toBe(true);
    expect(report.days).toBe(0);
    expect(report.changes).toBeGreaterThan(0);
    expect(await db.journalEntry.count(where)).toBe(report.changes);
    const players = await db.player.findMany({ ...where, orderBy: { id: "asc" } });
    expect(players.map((row) => row.id)).toEqual([1, 2, 4]);
    expect(players.find((row) => row.id === 2)?.alliance).toBeNull();
    expect(await mapVersion()).toBe("202611010105");
    expect(await readVersions()).toEqual([
      ["alliances", "202611010105"],
      ["players", "202611010105"],
    ]);
    expect(await db.playerDay.count(where)).toBe(3);
    expect(unknown).toEqual([]);
  });

  it("takes the previous reading from the database when the game no longer publishes it", async () => {
    const journalBefore = await db.journalEntry.count(where);
    published = {
      "202611010205": {
        players: [player(1, "BBB"), player(2, null), player(4, null)],
        alliances: [alliance("AAA", 0), alliance("BBB", 1)],
      },
    };
    requested.length = 0;
    const report = await ingestServer(db, server, new Date("2026-11-01T04:00:00Z"));
    expect(report.updated).toBe(true);
    expect(await db.journalEntry.count(where)).toBeGreaterThan(journalBefore);
    expect((await db.player.findUnique({ where: { server_id: { server: server.id, id: 1 } } }))?.alliance).toBe("BBB");
    expect(await db.alliance.count(where)).toBe(2);
    expect(requested.filter((address) => address.includes("version=202611010105"))).toEqual([]);
    expect(unknown).toEqual([]);
  });

  it("stores a new night once", async () => {
    const latest = published["202611010205"];
    if (!latest) throw new Error("The previous test's export is missing");
    published["202611020005"] = latest;
    const report = await ingestServer(db, server, new Date("2026-11-02T02:00:00Z"));
    expect(report.days).toBe(1);
    const days = await db.playerDay.groupBy({ by: ["day"], where: { server: server.id } });
    expect(await db.playerDay.count(where)).toBe(6);
    expect(days).toHaveLength(2);
    expect(unknown).toEqual([]);
  });
});
