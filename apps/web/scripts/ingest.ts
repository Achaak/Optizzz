// The hourly cron (on the VPS, deploy/ingest.sh): `pnpm ingest` reads every server's public exports; `-- --server s5` only some.
// Once something changed, it asks the site to rebuild its pages. See docs/features/site-public.md.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { SERVERS, serverById } from "@optizzz/game/servers";
import { PrismaClient } from "../src/generated/prisma/client";
import { ingestServer } from "../src/ingest/ingest";
import type { IngestReport } from "../src/lib/admin/job-runs";

/** How long the back office keeps the runs of the VPS tasks. */
const KEEP_RUNS_DAYS = 30;
const message = (error: unknown) => (error instanceof Error ? error.message : String(error)).slice(0, 500);

function chosenServers(args: readonly string[]) {
  const ids = args.flatMap((arg, i) => {
    const next = args[i + 1];
    return arg === "--server" && next ? [next] : [];
  });
  if (ids.length === 0) return SERVERS;
  return ids.map((id) => {
    const server = serverById(id);
    if (!server) throw new Error(`Unknown server: ${id}`);
    return server;
  });
}

/** Asks the site to rebuild its pages; null without SITE_URL (local runs), where nothing is asked. */
async function revalidate(): Promise<true | null> {
  const site = process.env.SITE_URL;
  if (!site) return null;
  const response = await fetch(`${site}/api/revalidate`, {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.REVALIDATE_SECRET ?? ""}` },
  });
  if (!response.ok) throw new Error(`Revalidation: ${String(response.status)}`);
  return true;
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const startedAt = new Date();
const run: IngestReport = { servers: [], revalidated: null };
let failed = false;
let updated = false;
for (const server of chosenServers(process.argv.slice(2))) {
  const start = Date.now();
  try {
    const report = await ingestServer(db, server, new Date());
    updated ||= report.updated || report.days > 0;
    run.servers.push({
      server: server.id,
      status: report.updated ? "updated" : "unchanged",
      changes: report.changes,
      days: report.days,
      ms: Date.now() - start,
    });
    console.log(
      `${server.name}: ${report.updated ? `updated, ${String(report.changes)} changes` : "unchanged"}, ${String(report.days)} days`,
    );
  } catch (error) {
    failed = true;
    run.servers.push({
      server: server.id,
      status: "failed",
      changes: 0,
      days: 0,
      ms: Date.now() - start,
      error: message(error),
    });
    console.error(`${server.name}: failed`, error);
  }
}
if (updated)
  try {
    run.revalidated = await revalidate();
  } catch (error) {
    // The data is stored: the pages catch up at the next pass.
    failed = true;
    run.revalidated = false;
    run.error = message(error);
    console.error("Revalidation failed", error);
  }
// For the back office (docs/features/site-back-office.md); a failure here never fails the pass.
try {
  await db.jobRun.create({ data: { job: "ingest", startedAt, endedAt: new Date(), ok: !failed, report: run } });
  await db.jobRun.deleteMany({
    where: { startedAt: { lt: new Date(startedAt.getTime() - KEEP_RUNS_DAYS * 24 * 60 * 60_000) } },
  });
} catch (error) {
  console.error("Could not record the run", error);
}
await db.$disconnect();
process.exitCode = failed ? 1 : 0;
