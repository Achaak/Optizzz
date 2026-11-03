// The VPS tasks as the back office reads them (docs/features/site-back-office.md): what each run of the hourly ingest
// and of the nightly backup stores in `JobRun.report`, and what is late or failing.
import { formatDecimal, formatNumber } from "@optizzz/game/format/number-format";
import { z } from "zod";

/** One server in a pass of the ingest. */
export const ingestServerSchema = z.object({
  server: z.string(),
  status: z.enum(["updated", "unchanged", "failed"]),
  /** Journal entries written. */
  changes: z.number().int().default(0),
  /** Nightly exports stored. */
  days: z.number().int().default(0),
  ms: z.number(),
  error: z.string().optional(),
});
export type IngestServer = z.infer<typeof ingestServerSchema>;

export const ingestReportSchema = z.object({
  servers: z.array(ingestServerSchema),
  /** null: nothing changed, the pages were not rebuilt. */
  revalidated: z.boolean().nullable(),
  error: z.string().optional(),
});
export type IngestReport = z.infer<typeof ingestReportSchema>;

export const backupReportSchema = z.object({
  file: z.string().nullable(),
  bytes: z.number().nullable(),
  /** The copy in the Scaleway bucket; null when no bucket is set. */
  copied: z.boolean().nullable(),
  /** The step that failed (« pg_dump », « rclone »…); absent or null when the run went through. */
  error: z.string().nullish(),
});
export type BackupReport = z.infer<typeof backupReportSchema>;

export interface Run<Report> {
  startedAt: Date;
  endedAt: Date;
  ok: boolean;
  /** null: a report this version cannot read. */
  report: Report | null;
}

interface StoredRun {
  startedAt: Date;
  endedAt: Date;
  ok: boolean;
  report: unknown;
}

export const readIngestRun = (run: StoredRun): Run<IngestReport> => ({
  ...run,
  report: ingestReportSchema.safeParse(run.report).data ?? null,
});

export const readBackupRun = (run: StoredRun): Run<BackupReport> => ({
  ...run,
  report: backupReportSchema.safeParse(run.report).data ?? null,
});

const MINUTE = 60_000;
/** The ingest starts each hour: beyond this, a pass was missed. */
export const INGEST_LATE_AFTER = 75 * MINUTE;
/** The backup runs each night: beyond this, one was missed. */
export const BACKUP_LATE_AFTER = 26 * 60 * MINUTE;

export type ServerState = "ok" | "failing" | "missing";

export interface ServerHealth {
  server: string;
  /** « S4 ». */
  name: string;
  /** « failing »: its latest pass failed; « missing »: no pass read it in the last 24 h. */
  state: ServerState;
  /** Its entry in the latest pass that read it. */
  last: (IngestServer & { at: Date }) | null;
  /** Failed passes over the last 24 h. */
  failures: number;
}

/** Each server's state from the ingest's runs, newest first. */
export function serverHealth(
  servers: readonly { id: string; name: string }[],
  runs: readonly Run<IngestReport>[],
  now: Date,
): ServerHealth[] {
  const day = runs.filter((run) => now.getTime() - run.startedAt.getTime() <= 24 * 60 * MINUTE);
  return servers.map(({ id, name }) => {
    const entries = day.flatMap((run) => {
      const entry = run.report?.servers.find((s) => s.server === id);
      return entry ? [{ ...entry, at: run.startedAt }] : [];
    });
    const last = entries[0] ?? null;
    return {
      server: id,
      name,
      state: !last ? "missing" : last.status === "failed" ? "failing" : "ok",
      last,
      failures: entries.filter((entry) => entry.status === "failed").length,
    };
  });
}

/** One thing that needs a look: what it is about, and what to say of it in the reader's words. */
export interface AdminAlert {
  topic: "cron" | "backup" | "discord";
  text: string;
}

/** What needs a look; empty when all is well. */
export function jobAlerts({
  health,
  lastIngest,
  lastBackup,
  now,
}: {
  health: readonly ServerHealth[];
  lastIngest: Run<IngestReport> | undefined;
  lastBackup: Run<BackupReport> | undefined;
  now: Date;
}): AdminAlert[] {
  const alerts: AdminAlert[] = [];
  const cron = (text: string) => alerts.push({ topic: "cron", text });
  const backup = (text: string) => alerts.push({ topic: "backup", text });
  if (!lastIngest) cron("Le cron n'a encore rien enregistré.");
  else if (now.getTime() - lastIngest.startedAt.getTime() > INGEST_LATE_AFTER)
    cron("Le cron n'a pas tourné depuis plus d'une heure.");
  else if (lastIngest.report?.revalidated === false)
    cron("Le dernier passage n'a pas pu reconstruire les pages du site.");
  for (const server of health) {
    if (server.state === "failing") cron(`${server.name} : le dernier passage a échoué.`);
    else if (server.state === "missing" && lastIngest) cron(`${server.name} : aucun passage depuis 24 h.`);
  }
  if (!lastBackup) backup("Aucune sauvegarde enregistrée.");
  else if (now.getTime() - lastBackup.startedAt.getTime() > BACKUP_LATE_AFTER)
    backup("Pas de sauvegarde depuis plus d'une nuit.");
  else if (!lastBackup.ok)
    backup(
      lastBackup.report?.copied === false
        ? "La dernière sauvegarde est sur le VPS mais pas dans le bucket Scaleway."
        : `La dernière sauvegarde a échoué${lastBackup.report?.error ? ` (${lastBackup.report.error})` : ""}.`,
    );
  return alerts;
}

/** « 18 s », « 2 min 14 s »: how long a run took. */
export function formatRunDuration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${String(seconds)} s`;
  return `${String(Math.floor(seconds / 60))} min ${String(seconds % 60).padStart(2, "0")} s`;
}

/** « 48 Mo », « 1,8 Go ». */
export function formatBytes(bytes: number): string {
  if (bytes < 1e9) return `${formatNumber(Math.max(1, Math.round(bytes / 1e6)))} Mo`;
  return `${formatDecimal(bytes / 1e9)} Go`;
}
