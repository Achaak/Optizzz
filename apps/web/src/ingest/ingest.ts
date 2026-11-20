// One pass of the hourly cron over a server: the current state, the Journal and the nightly scores — see
// docs/features/site-public.md.
import { probableFloods } from "@optizzz/game/analysis/floods";
import { versionDate } from "@optizzz/game/export-versions";
import {
  allianceSchema,
  exportUrl,
  playerSchema,
  versionsSchema,
  type Alliance,
  type ExportKind,
  type Player,
} from "@optizzz/game/exports";
import type { GameServer } from "@optizzz/game/servers";
import { encodeMapData } from "@optizzz/map/map-data";
import { gzipSync } from "node:zlib";
import { z } from "zod";
import type { Alliance as AllianceRow, Player as PlayerRow, Prisma, PrismaClient } from "~/generated/prisma/client";
import { columnDay, dayColumn, missingDays } from "./days";
import { diffReadings, type Reading } from "./diff";
import { playerWrites } from "./player-writes";

/** Nightly exports taken back per pass: the history comes back in a few hours, without a burst of downloads. */
const DAYS_PER_PASS = 10;
/** Rows per insert. */
const CHUNK = 5000;

/** Attempts per download: the API sometimes drops the connection in the middle of S4's export. */
const ATTEMPTS = 3;

/** The message with what Node's `fetch` hides behind « fetch failed » (ECONNRESET, a socket closed…). */
function describe(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const { cause } = error;
  if (cause instanceof Error) {
    const code = (cause as Error & { code?: string }).code;
    return `${error.message} (${code ? `${code}: ` : ""}${cause.message})`;
  }
  return error.message;
}

async function getJsonOnce(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { "user-agent": "Optizzz (https://optizzz.fr)" },
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) throw new Error(`Fourmizzz API: ${String(response.status)} on ${url}`);
  return response.json();
}

async function getJson(url: string): Promise<unknown> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await getJsonOnce(url);
    } catch (error) {
      if (attempt >= ATTEMPTS)
        throw new Error(`${describe(error)} on ${url} (${String(ATTEMPTS)} attempts)`, {
          cause: error,
        });
      await new Promise((resolve) => setTimeout(resolve, 10_000 * attempt));
    }
  }
}

const playersOf = async (origin: string, version: string) =>
  z.array(playerSchema).parse(await getJson(exportUrl(origin, "players", version)));
const alliancesOf = async (origin: string, version: string) =>
  z.array(allianceSchema).parse(await getJson(exportUrl(origin, "alliances", version)));

async function inChunks<T>(rows: readonly T[], insert: (chunk: T[]) => Promise<unknown>, size = CHUNK) {
  for (let start = 0; start < rows.length; start += size) await insert(rows.slice(start, start + size));
}

/**
 * A night of the curves, all or none, after the latest night stored on `server`: a new row for each player whose
 * scores changed since (or new, or back), `until` on the rows no longer true (changed or gone), and the night in
 * ServerDay. A night counts as stored as soon as it is in ServerDay, so a pass cut half-way must leave nothing.
 */
export const storeNight = (db: PrismaClient, server: string, day: string, players: readonly Player[], size = CHUNK) =>
  db.$transaction(
    async (tx) => {
      const date = dayColumn(day);
      const latest = await tx.serverDay.findFirst({
        where: { server },
        orderBy: { day: "desc" },
        select: { day: true },
      });
      if (latest && columnDay(latest.day) >= day)
        throw new Error(`${server}: the night ${day} is not after the latest stored (${columnDay(latest.day)})`);
      await tx.$executeRaw`
        CREATE TEMP TABLE night ("playerId" int PRIMARY KEY, alliance text, field float8, "buildingScore" int,
          "technologyScore" int, "trophyScore" int) ON COMMIT DROP`;
      await inChunks(
        players,
        (chunk) => tx.$executeRaw`
          INSERT INTO night SELECT * FROM unnest(
            ${chunk.map((p) => p.id)}::int[], ${chunk.map((p) => p.alliance)}::text[],
            ${chunk.map((p) => p.field)}::float8[], ${chunk.map((p) => p.buildingScore)}::int[],
            ${chunk.map((p) => p.technologyScore)}::int[], ${chunk.map((p) => p.trophyScore)}::int[])`,
        size,
      );
      await tx.$executeRaw`
        UPDATE "public"."PlayerDay" d SET "until" = ${date}::date
        WHERE d.server = ${server} AND d."until" IS NULL AND NOT EXISTS (
          SELECT 1 FROM night n WHERE n."playerId" = d."playerId" AND n.alliance IS NOT DISTINCT FROM d.alliance
            AND n.field = d.field AND n."buildingScore" = d."buildingScore"
            AND n."technologyScore" = d."technologyScore" AND n."trophyScore" = d."trophyScore")`;
      await tx.$executeRaw`
        INSERT INTO "public"."PlayerDay" (server, "playerId", day, alliance, field, "buildingScore", "technologyScore",
          "trophyScore")
        SELECT ${server}, n."playerId", ${date}::date, n.alliance, n.field, n."buildingScore", n."technologyScore",
          n."trophyScore"
        FROM night n
        WHERE NOT EXISTS (SELECT 1 FROM "public"."PlayerDay" d
          WHERE d.server = ${server} AND d."playerId" = n."playerId" AND d."until" IS NULL)`;
      await tx.serverDay.create({
        data: { server, day: date, players: players.length, field: players.reduce((sum, p) => sum + p.field, 0) },
      });
    },
    { timeout: 600_000, maxWait: 30_000 },
  );

/** Inserts or updates `players` in one statement: one array per column, unlike `createMany` and its 70 000 parameters. */
const upsertPlayers = (tx: Prisma.TransactionClient, server: string, players: readonly Player[]) =>
  tx.$executeRaw`
    INSERT INTO "public"."Player" ("server", "id", "pseudo", "alliance", "masterId", "x", "y", "field", "grade",
      "buildingScore", "technologyScore", "trophyScore", "onHoliday", "isBanned")
    SELECT ${server}, * FROM unnest(
      ${players.map((p) => p.id)}::int[], ${players.map((p) => p.pseudo)}::text[],
      ${players.map((p) => p.alliance)}::text[], ${players.map((p) => p.masterPlayerId)}::int[],
      ${players.map((p) => p.x)}::int[], ${players.map((p) => p.y)}::int[], ${players.map((p) => p.field)}::float8[],
      ${players.map((p) => p.grade)}::text[], ${players.map((p) => p.buildingScore)}::int[],
      ${players.map((p) => p.technologyScore)}::int[], ${players.map((p) => p.trophyScore)}::int[],
      ${players.map((p) => p.onHoliday)}::boolean[], ${players.map((p) => p.isBanned)}::boolean[])
    ON CONFLICT ("server", "id") DO UPDATE SET
      "pseudo" = EXCLUDED."pseudo", "alliance" = EXCLUDED."alliance", "masterId" = EXCLUDED."masterId",
      "x" = EXCLUDED."x", "y" = EXCLUDED."y", "field" = EXCLUDED."field", "grade" = EXCLUDED."grade",
      "buildingScore" = EXCLUDED."buildingScore", "technologyScore" = EXCLUDED."technologyScore",
      "trophyScore" = EXCLUDED."trophyScore", "onHoliday" = EXCLUDED."onHoliday", "isBanned" = EXCLUDED."isBanned"`;

const toPlayer = (row: PlayerRow): Player => ({
  id: row.id,
  pseudo: row.pseudo,
  alliance: row.alliance,
  masterPlayerId: row.masterId,
  x: row.x,
  y: row.y,
  field: row.field,
  grade: row.grade,
  buildingScore: row.buildingScore,
  technologyScore: row.technologyScore,
  trophyScore: row.trophyScore,
  onHoliday: row.onHoliday,
  isBanned: row.isBanned,
});

const diplomacySchema = allianceSchema.shape.diplomacy;

const toAlliance = (row: AllianceRow): Alliance => ({
  tag: row.tag,
  name: row.name,
  playersCount: row.playersCount,
  totalField: row.totalField,
  totalBuildingScore: row.totalBuildingScore,
  totalTechnologyScore: row.totalTechnologyScore,
  totalTrophyScore: row.totalTrophyScore,
  diplomacy: diplomacySchema.parse(row.diplomacy),
});

/** Days the hourly moves and floods are kept. */
const HOURLY_DAYS = 30;
/** Two readings further apart than this: no probable flood is looked for between them. */
const MAX_FLOOD_GAP_MS = 3 * 3_600_000;

/** The players whose field moved between two readings: their new field and the move. */
export function fieldMoves(before: readonly Player[], after: readonly Player[]) {
  const was = new Map(before.map((player) => [player.id, player.field]));
  return after.flatMap((player) => {
    const field = was.get(player.id);
    return field === undefined || field === player.field
      ? []
      : [{ playerId: player.id, field: player.field, delta: player.field - field }];
  });
}

export interface PassReport {
  /** The current state was replaced by a newer export. */
  updated: boolean;
  changes: number;
  /** Nightly exports stored this pass. */
  days: number;
}

/** Downloads what changed on `server` since the last pass and stores it. */
export async function ingestServer(db: PrismaClient, server: GameServer, now: Date): Promise<PassReport> {
  const versions = versionsSchema.parse(await getJson(exportUrl(server.origin)));
  const [latestPlayers] = versions.players;
  const [latestAlliances] = versions.alliances;
  if (!latestPlayers || !latestAlliances) throw new Error(`${server.name}: no export published`);
  const latest: Record<ExportKind, string> = { players: latestPlayers, alliances: latestAlliances };
  const reads = await db.exportRead.findMany({ where: { server: server.id } });
  const readOf = (kind: ExportKind) => reads.find((read) => read.kind === kind)?.version;

  const report: PassReport = { updated: false, changes: 0, days: 0 };
  // Kept for the current state, its map and the nightly export of the same version; a night read only once is not
  // kept (`keep: false`): ten of S4's (216 000 players each) would not fit in the VPS's memory.
  const downloaded = new Map<string, Player[] | Alliance[]>();
  const players = async (version: string, keep = true) => {
    const key = `players:${version}`;
    const cached = downloaded.get(key) as Player[] | undefined;
    if (cached) return cached;
    const fresh = await playersOf(server.origin, version);
    if (keep) downloaded.set(key, fresh);
    return fresh;
  };
  const alliances = async (version: string, keep = true) => {
    const key = `alliances:${version}`;
    const cached = downloaded.get(key) as Alliance[] | undefined;
    if (cached) return cached;
    const fresh = await alliancesOf(server.origin, version);
    if (keep) downloaded.set(key, fresh);
    return fresh;
  };

  const since = readOf("players");
  if (since !== latest.players || readOf("alliances") !== latest.alliances) {
    const after: Reading = {
      version: latest.players,
      players: await players(latest.players),
      alliances: await alliances(latest.alliances),
    };
    // The first pass on a server has nothing to compare with: the Journal starts at the next one. The previous
    // reading comes back from the API while it is still published: reading it from the database would count every
    // player against the database's network transfer, each hour.
    const sinceAlliances = readOf("alliances");
    const before: Reading | null = since
      ? versions.players.includes(since) && sinceAlliances && versions.alliances.includes(sinceAlliances)
        ? { version: since, players: await players(since), alliances: await alliances(sinceAlliances) }
        : {
            version: since,
            players: (await db.player.findMany({ where: { server: server.id } })).map(toPlayer),
            alliances: (await db.alliance.findMany({ where: { server: server.id } })).map(toAlliance),
          }
      : null;
    const notes = before ? diffReadings(before, after) : [];
    await db.$transaction(
      async (tx) => {
        // Only what changed since `before`, which is what the rows hold (written with its ExportRead).
        const writes = before ? playerWrites(before.players, after.players) : { upserts: after.players, removed: [] };
        if (!before) await tx.player.deleteMany({ where: { server: server.id } });
        if (writes.removed.length > 0)
          await tx.player.deleteMany({ where: { server: server.id, id: { in: writes.removed } } });
        await inChunks(writes.upserts, (chunk) => upsertPlayers(tx, server.id, chunk));
        await tx.alliance.deleteMany({ where: { server: server.id } });
        await tx.alliance.createMany({
          data: after.alliances.map((alliance) => ({
            server: server.id,
            tag: alliance.tag,
            name: alliance.name,
            playersCount: alliance.playersCount,
            totalField: alliance.totalField,
            totalBuildingScore: alliance.totalBuildingScore,
            totalTechnologyScore: alliance.totalTechnologyScore,
            totalTrophyScore: alliance.totalTrophyScore,
            diplomacy: alliance.diplomacy,
          })),
        });
        if (before)
          await inChunks(notes, (chunk) =>
            tx.journalEntry.createMany({
              data: chunk.map((note) => ({
                server: server.id,
                playerId: note.playerId,
                tag: note.tag,
                name: note.name,
                since: before.version,
                until: after.version,
                at: versionDate(after.version),
                change: note.change,
              })),
            }),
          );
        if (before) {
          // The hour's moves of the field and its probable floods (docs/features/site-analyse.md).
          const since = versionDate(before.version);
          const at = versionDate(after.version);
          await inChunks(fieldMoves(before.players, after.players), (chunk) =>
            tx.playerHour.createMany({
              data: chunk.map((move) => ({ server: server.id, since, at, ...move })),
              skipDuplicates: true,
            }),
          );
          const victimAlliance = new Map(before.players.map((player) => [player.id, player.alliance]));
          // Over a longer gap (the cron missed passes) the sums mix too many moves to match anything.
          const floods =
            at.getTime() - since.getTime() <= MAX_FLOOD_GAP_MS ? probableFloods(before.players, after.players) : [];
          await inChunks(floods, (chunk) =>
            tx.probableFlood.createMany({
              data: chunk.map((flood) => ({
                server: server.id,
                since,
                at,
                victimId: flood.victimId,
                victimAlliance: victimAlliance.get(flood.victimId) ?? null,
                amount: flood.amount,
                attackers: flood.attackers,
                candidates: flood.candidates,
                alliance: flood.alliance,
                sureness: flood.sureness,
              })),
            }),
          );
        }
        for (const kind of ["players", "alliances"] as const)
          await tx.exportRead.upsert({
            where: { server_kind: { server: server.id, kind } },
            create: { server: server.id, kind, version: latest[kind] },
            update: { version: latest[kind] },
          });
      },
      // The first pass on S4 writes 216 000 players; the site reads the old rows meanwhile. `maxWait`: the pool may
      // still be releasing the previous server's connection.
      { timeout: 600_000, maxWait: 30_000 },
    );
    report.updated = true;
    report.changes = notes.length;
  }

  // The hourly rows are kept 30 days: enough for 4 weeks of « Quand son TDC bouge ».
  const kept = new Date(now.getTime() - HOURLY_DAYS * 24 * 3_600_000);
  await db.playerHour.deleteMany({ where: { server: server.id, at: { lt: kept } } });
  await db.probableFlood.deleteMany({ where: { server: server.id, at: { lt: kept } } });

  // The map's file follows the current state; written again when missing (a server read before the map existed).
  const map = await db.mapFile.findUnique({ where: { server: server.id }, select: { version: true } });
  if (map?.version !== latest.players) {
    const gzip = gzipSync(
      JSON.stringify(encodeMapData(latest.players, await players(latest.players), await alliances(latest.alliances))),
    );
    await db.mapFile.upsert({
      where: { server: server.id },
      create: { server: server.id, version: latest.players, gzip },
      update: { version: latest.players, gzip },
    });
  }

  const latestNight = await db.serverDay.findFirst({
    where: { server: server.id },
    orderBy: { day: "desc" },
    select: { day: true },
  });
  for (const { day, version } of missingDays(
    versions.players,
    latestNight ? columnDay(latestNight.day) : null,
    now,
    DAYS_PER_PASS,
  )) {
    await storeNight(db, server.id, day, await players(version, false));
    report.days++;
  }

  const latestAllianceDay = await db.allianceDay.aggregate({ where: { server: server.id }, _max: { day: true } });
  for (const { day, version } of missingDays(
    versions.alliances,
    latestAllianceDay._max.day ? columnDay(latestAllianceDay._max.day) : null,
    now,
    DAYS_PER_PASS,
  )) {
    const rows = (await alliances(version, false)).map((alliance) => ({
      server: server.id,
      tag: alliance.tag,
      day: dayColumn(day),
      playersCount: alliance.playersCount,
      totalField: alliance.totalField,
      totalBuildingScore: alliance.totalBuildingScore,
      totalTechnologyScore: alliance.totalTechnologyScore,
      totalTrophyScore: alliance.totalTrophyScore,
    }));
    await db.allianceDay.createMany({ data: rows, skipDuplicates: true });
  }
  return report;
}
