// One pass of the hourly cron over a server: the current state, the Journal and the nightly scores — see
// docs/features/site-public.md.
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
import type { Alliance as AllianceRow, Player as PlayerRow, PrismaClient } from "~/generated/prisma/client";
import { columnDay, dayColumn, missingDays } from "./days";
import { diffReadings, type Reading } from "./diff";

/** Nightly exports taken back per pass: the history comes back in a few hours, without a burst of downloads. */
const DAYS_PER_PASS = 10;
/** Rows per insert. */
const CHUNK = 5000;

async function getJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { "user-agent": "Optizzz (https://optizzz.fr)" },
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`Fourmizzz API: ${String(response.status)} on ${url}`);
  return response.json();
}

const playersOf = async (origin: string, version: string) =>
  z.array(playerSchema).parse(await getJson(exportUrl(origin, "players", version)));
const alliancesOf = async (origin: string, version: string) =>
  z.array(allianceSchema).parse(await getJson(exportUrl(origin, "alliances", version)));

async function inChunks<T>(rows: readonly T[], insert: (chunk: T[]) => Promise<unknown>) {
  for (let start = 0; start < rows.length; start += CHUNK) await insert(rows.slice(start, start + CHUNK));
}

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
  const downloaded = new Map<string, Player[] | Alliance[]>();
  const players = async (version: string) => {
    const key = `players:${version}`;
    const cached = downloaded.get(key) as Player[] | undefined;
    if (cached) return cached;
    const fresh = await playersOf(server.origin, version);
    downloaded.set(key, fresh);
    return fresh;
  };
  const alliances = async (version: string) => {
    const key = `alliances:${version}`;
    const cached = downloaded.get(key) as Alliance[] | undefined;
    if (cached) return cached;
    const fresh = await alliancesOf(server.origin, version);
    downloaded.set(key, fresh);
    return fresh;
  };

  const since = readOf("players");
  if (since !== latest.players || readOf("alliances") !== latest.alliances) {
    const after: Reading = {
      version: latest.players,
      players: await players(latest.players),
      alliances: await alliances(latest.alliances),
    };
    // The first pass on a server has nothing to compare with: the Journal starts at the next one.
    const before: Reading | null = since
      ? {
          version: since,
          players: (await db.player.findMany({ where: { server: server.id } })).map(toPlayer),
          alliances: (await db.alliance.findMany({ where: { server: server.id } })).map(toAlliance),
        }
      : null;
    const notes = before ? diffReadings(before, after) : [];
    await db.$transaction(
      async (tx) => {
        await tx.player.deleteMany({ where: { server: server.id } });
        await inChunks(after.players, (chunk) =>
          tx.player.createMany({
            data: chunk.map((player) => ({
              server: server.id,
              id: player.id,
              pseudo: player.pseudo,
              alliance: player.alliance,
              masterId: player.masterPlayerId,
              x: player.x,
              y: player.y,
              field: player.field,
              grade: player.grade,
              buildingScore: player.buildingScore,
              technologyScore: player.technologyScore,
              trophyScore: player.trophyScore,
              onHoliday: player.onHoliday,
              isBanned: player.isBanned,
            })),
          }),
        );
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
        for (const kind of ["players", "alliances"] as const)
          await tx.exportRead.upsert({
            where: { server_kind: { server: server.id, kind } },
            create: { server: server.id, kind, version: latest[kind] },
            update: { version: latest[kind] },
          });
      },
      { timeout: 120_000 },
    );
    report.updated = true;
    report.changes = notes.length;
  }

  // The map's file follows the current state; written again when missing (a server read before the map existed).
  const map = await db.mapFile.findUnique({ where: { server: server.id }, select: { version: true } });
  if (map?.version !== latest.players) {
    const current = report.updated
      ? { players: await players(latest.players), alliances: await alliances(latest.alliances) }
      : {
          players: (await db.player.findMany({ where: { server: server.id } })).map(toPlayer),
          alliances: (await db.alliance.findMany({ where: { server: server.id } })).map(toAlliance),
        };
    const gzip = gzipSync(JSON.stringify(encodeMapData(latest.players, current.players, current.alliances)));
    await db.mapFile.upsert({
      where: { server: server.id },
      create: { server: server.id, version: latest.players, gzip },
      update: { version: latest.players, gzip },
    });
  }

  const storedPlayerDays = await db.playerDay.findMany({
    where: { server: server.id },
    distinct: ["day"],
    select: { day: true },
  });
  for (const { day, version } of missingDays(
    versions.players,
    new Set(storedPlayerDays.map((row) => columnDay(row.day))),
    now,
    DAYS_PER_PASS,
  )) {
    const rows = (await players(version)).map((player) => ({
      server: server.id,
      playerId: player.id,
      day: dayColumn(day),
      alliance: player.alliance,
      field: player.field,
      buildingScore: player.buildingScore,
      technologyScore: player.technologyScore,
      trophyScore: player.trophyScore,
    }));
    await inChunks(rows, (chunk) => db.playerDay.createMany({ data: chunk, skipDuplicates: true }));
    report.days++;
  }

  const storedAllianceDays = await db.allianceDay.findMany({
    where: { server: server.id },
    distinct: ["day"],
    select: { day: true },
  });
  for (const { day, version } of missingDays(
    versions.alliances,
    new Set(storedAllianceDays.map((row) => columnDay(row.day))),
    now,
    DAYS_PER_PASS,
  )) {
    const rows = (await alliances(version)).map((alliance) => ({
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
