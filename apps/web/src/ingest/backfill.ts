// Taking back the hourly moves and probable floods of the last 30 days from the exports the game still publishes
// (docs/features/site-analyse.md, « Reprise »). By hand, once: `pnpm backfill` (deploy/backfill.sh on the VPS).
import { versionDate } from "@optizzz/game/export-versions";
import { exportUrl, versionsSchema, type Player } from "@optizzz/game/exports";
import type { GameServer } from "@optizzz/game/servers";
import type { PrismaClient } from "~/generated/prisma/client";
import { getJson, HOURLY_DAYS, playersOf, writeHour } from "./ingest";

export interface BackfillReport {
  /** Hours written. */
  hours: number;
  /** Hours the cron (or a previous backfill) had already written. */
  skipped: number;
}

/**
 * Each hour of the last 30 days up to the latest export the cron read, oldest first, written as the cron writes it,
 * unless some move of the field is already stored at its end: it can run again, and beside the cron, which only
 * writes the hours after it. `pauseMs` between two downloads spares the game's servers (S4's export weighs 44 MB).
 */
export async function backfillHourly(
  db: PrismaClient,
  server: GameServer,
  now: Date,
  { pauseMs = 2000, log = () => undefined }: { pauseMs?: number; log?: (line: string) => void } = {},
): Promise<BackfillReport> {
  const read = await db.exportRead.findUnique({ where: { server_kind: { server: server.id, kind: "players" } } });
  if (!read) return { hours: 0, skipped: 0 };
  const from = new Date(now.getTime() - HOURLY_DAYS * 24 * 3_600_000);
  const versions = versionsSchema
    .parse(await getJson(exportUrl(server.origin)))
    .players.filter((version) => versionDate(version) >= from && version <= read.version)
    .sort();
  const written = new Set(
    (
      await db.playerHour.findMany({
        where: { server: server.id, at: { gte: from } },
        distinct: ["at"],
        select: { at: true },
      })
    ).map((row) => row.at.getTime()),
  );
  const report: BackfillReport = { hours: 0, skipped: 0 };
  let before: { version: string; players: Player[] } | null = null;
  for (const [i, version] of versions.entries()) {
    const next = versions[i + 1];
    // A version only read as the start of a written hour is not downloaded at all.
    const needed = !written.has(versionDate(version).getTime()) || (next && !written.has(versionDate(next).getTime()));
    if (i > 0 && written.has(versionDate(version).getTime())) report.skipped++;
    if (!needed) {
      before = null;
      continue;
    }
    if (pauseMs > 0 && before !== null) await new Promise((resolve) => setTimeout(resolve, pauseMs));
    const after = { version, players: await playersOf(server.origin, version) };
    if (before && !written.has(versionDate(version).getTime())) {
      await writeHour(db, server.id, before, after);
      report.hours++;
      log(`${server.name}: ${version} (${String(report.hours)} hours)`);
    }
    before = after;
  }
  return report;
}
