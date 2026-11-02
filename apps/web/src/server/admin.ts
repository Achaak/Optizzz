// The back office's gate (docs/features/site-back-office.md): an account whose verified address is in ADMIN_EMAILS.
import "server-only";

import { SERVERS } from "@optizzz/game/servers";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { env } from "~/env";
import { isAdmin, parseAdminEmails } from "~/lib/admin/admin-emails";
import { jobAlerts, readBackupRun, readIngestRun, serverHealth } from "~/lib/admin/job-runs";
import { auth } from "~/server/auth";
import { db } from "~/server/db";

const admins = parseAdminEmails(env.ADMIN_EMAILS);
const DAY = 24 * 60 * 60_000;

/** The admin's session; anyone else gets the site's 404, which does not tell the back office exists. */
export async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers(), query: { disableRefresh: true } });
  if (!session || !isAdmin(admins, session.user)) notFound();
  return session;
}

/** The VPS tasks' runs and what needs a look, for the overview and the « Collecte » page. */
export async function loadJobs(now: Date) {
  const [day, backupRows] = await Promise.all([
    db.jobRun.findMany({
      where: { job: "ingest", startedAt: { gte: new Date(now.getTime() - DAY) } },
      orderBy: { startedAt: "desc" },
    }),
    db.jobRun.findMany({ where: { job: "backup" }, orderBy: { startedAt: "desc" }, take: 7 }),
  ]);
  const lastDay = day.map(readIngestRun);
  // A pass older than 24 h still says when the cron last ran.
  const lastIngest =
    lastDay[0] ??
    (await db.jobRun
      .findFirst({ where: { job: "ingest" }, orderBy: { startedAt: "desc" } })
      .then((run) => run && readIngestRun(run))) ??
    undefined;
  const backups = backupRows.map(readBackupRun);
  const health = serverHealth(SERVERS, lastDay, now);
  return {
    /** The ingest's runs over the last 24 h, newest first. */
    lastDay,
    lastIngest,
    backups,
    health,
    alerts: jobAlerts({ health, lastIngest, lastBackup: backups[0], now }),
  };
}
