// The players' scores night by night — see docs/features/site-public.md, « Ce que garde la base » : a PlayerDay row
// holds every night (ServerDay) of [day, until), as the cron stores only what changed.
import type { PrismaClient } from "~/generated/prisma/client";

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

/** The rank by TDC of the players `ids` on each night from `since` on, 1 first. */
export const playerNightRanks = async (db: PrismaClient, server: string, ids: readonly number[], since: Date | null) =>
  (
    await db.$queryRaw<{ id: number; day: Date; rank: bigint }[]>`
      SELECT d."playerId" AS id, s.day, (
        SELECT count(*) FROM "PlayerDay" o
        WHERE o.server = s.server AND o.day <= s.day AND (o.until IS NULL OR o.until > s.day) AND o.field > d.field
      ) + 1 AS rank
      FROM "ServerDay" s
      JOIN "PlayerDay" d ON d.server = s.server AND d.day <= s.day AND (d.until IS NULL OR d.until > s.day)
      WHERE s.server = ${server} AND d."playerId" = ANY(${[...ids]}) AND s.day >= ${since ?? new Date(0)}::date
      ORDER BY s.day`
  ).map((row) => ({ id: row.id, day: row.day, rank: Number(row.rank) }));
