// The hourly cron (GitHub Actions): `pnpm ingest` reads every server's public exports; `-- --server s5` only some.
// Once something changed, it asks the site to rebuild its pages. See docs/features/site-public.md.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { SERVERS, serverById } from "@optizzz/game/servers";
import { PrismaClient } from "../src/generated/prisma/client";
import { ingestServer } from "../src/ingest/ingest";

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

async function revalidate() {
  const site = process.env.SITE_URL;
  if (!site) return;
  const response = await fetch(`${site}/api/revalidate`, {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.REVALIDATE_SECRET ?? ""}` },
  });
  if (!response.ok) throw new Error(`Revalidation: ${String(response.status)}`);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

let failed = false;
let updated = false;
for (const server of chosenServers(process.argv.slice(2))) {
  try {
    const report = await ingestServer(db, server, new Date());
    updated ||= report.updated || report.days > 0;
    console.log(
      `${server.name}: ${report.updated ? `updated, ${String(report.changes)} changes` : "unchanged"}, ${String(report.days)} days`,
    );
  } catch (error) {
    failed = true;
    console.error(`${server.name}: failed`, error);
  }
}
if (updated)
  try {
    await revalidate();
  } catch (error) {
    // The data is stored: the pages catch up at the next pass.
    failed = true;
    console.error("Revalidation failed", error);
  }
await db.$disconnect();
process.exitCode = failed ? 1 : 0;
