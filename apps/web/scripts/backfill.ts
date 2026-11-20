// Takes back the hourly moves and probable floods of the last 30 days (docs/features/site-analyse.md, « Reprise »):
// `pnpm backfill` for every server, `-- --server s5` for some. On the VPS: deploy/backfill.sh. It can run beside the
// hourly cron and again: an hour already written is skipped. The pages catch up at the cron's next pass.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { SERVERS, serverById } from "@optizzz/game/servers";
import { PrismaClient } from "../src/generated/prisma/client";
import { backfillHourly } from "../src/ingest/backfill";

const ids = process.argv.slice(2).flatMap((arg, i, args) => (arg === "--server" && args[i + 1] ? [args[i + 1]] : []));
const servers =
  ids.length === 0
    ? SERVERS
    : ids.map((id) => {
        const server = serverById(id ?? "");
        if (!server) throw new Error(`Unknown server: ${String(id)}`);
        return server;
      });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

let failed = false;
for (const server of servers) {
  const start = Date.now();
  try {
    const report = await backfillHourly(db, server, new Date(), { log: (line) => console.log(line) });
    console.log(
      `${server.name}: ${String(report.hours)} hours written, ${String(report.skipped)} already there, ${String(Math.round((Date.now() - start) / 60_000))} min`,
    );
  } catch (error) {
    failed = true;
    console.error(`${server.name}: failed`, error);
  }
}
await db.$disconnect();
process.exitCode = failed ? 1 : 0;
