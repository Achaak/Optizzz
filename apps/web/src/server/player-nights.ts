// The players' scores night by night — see docs/features/site-public.md, « Ce que garde la base » : a PlayerDay row
// holds every night (ServerDay) of [day, until), as the cron stores only what changed.
import type { PrismaClient } from "~/generated/prisma/client";
import { nightRanks, nightTable, type NightTable } from "~/lib/night-ranks";

/** A player's scores on one night. */
export interface PlayerNight {
  playerId: number;
  day: Date;
  alliance: string | null;
  field: number;
  buildingScore: number;
  technologyScore: number;
  trophyScore: number;
}

/** Each night of `server` from `since` on (every night when null), with the scores of the players `ids`, oldest first. */
export const playerNights = (db: PrismaClient, server: string, ids: readonly number[], since: Date | null) =>
  db.$queryRaw<PlayerNight[]>`
    SELECT d."playerId", s.day, d.alliance, d.field, d."buildingScore", d."technologyScore", d."trophyScore"
    FROM "ServerDay" s
    JOIN "PlayerDay" d ON d.server = s.server AND d.day <= s.day AND (d.until IS NULL OR d.until > s.day)
    WHERE s.server = ${server} AND d."playerId" = ANY(${[...ids]}) AND s.day >= ${since ?? new Date(0)}::date
    ORDER BY s.day`;

/**
 * Each server's rows for the ranks, read again once a new night is stored: the cron writes PlayerDay and ServerDay in
 * the same transaction (storeNight), so the latest night says whether the rows held are still the stored ones.
 */
const tables = new Map<string, { latest: number; table: Promise<NightTable> }>();

async function loadTable(db: PrismaClient, server: string): Promise<NightTable> {
  const [nights, rows] = await Promise.all([
    db.serverDay.findMany({ where: { server }, orderBy: { day: "asc" }, select: { day: true } }),
    db.playerDay.findMany({ where: { server }, select: { playerId: true, field: true, day: true, until: true } }),
  ]);
  return nightTable(
    nights.map((night) => night.day),
    rows,
  );
}

async function tableOf(db: PrismaClient, server: string): Promise<NightTable> {
  const last = await db.serverDay.findFirst({ where: { server }, orderBy: { day: "desc" }, select: { day: true } });
  const latest = last?.day.getTime() ?? 0;
  const held = tables.get(server);
  if (held?.latest === latest) return held.table;
  // Shared by the pages rebuilt at the same time; forgotten if it fails, to be read again at the next page.
  const table = loadTable(db, server);
  tables.set(server, { latest, table });
  table.catch(() => {
    if (tables.get(server)?.table === table) tables.delete(server);
  });
  return table;
}

/** The rank by TDC of the players `ids` on each night from `since` on, 1 first. */
export const playerNightRanks = async (db: PrismaClient, server: string, ids: readonly number[], since: Date | null) =>
  nightRanks(
    await tableOf(db, server),
    ids,
    // From the night of `since`, as `playerNights` and its `::date` (nights are UTC midnights).
    since && new Date(Date.UTC(since.getUTCFullYear(), since.getUTCMonth(), since.getUTCDate())),
  );
