import { describe, expect, it } from "vitest";
import {
  formatBytes,
  formatRunDuration,
  jobAlerts,
  readBackupRun,
  readIngestRun,
  serverHealth,
  type IngestServer,
} from "./job-runs";

const NOW = new Date("2026-11-02T13:36:00Z");
const ago = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000);
const SERVERS = [
  { id: "s4", name: "S4" },
  { id: "s5", name: "S5" },
];

const entry = (server: string, status: IngestServer["status"]) => ({ server, status, changes: 3, days: 0, ms: 1200 });
const ingest = (minutesAgo: number, servers: object[], revalidated: boolean | null = true) =>
  readIngestRun({
    startedAt: ago(minutesAgo),
    endedAt: ago(minutesAgo - 2),
    ok: servers.every((s) => (s as IngestServer).status !== "failed"),
    report: { servers, revalidated },
  });
const backup = (minutesAgo: number, ok: boolean, report: object = { copied: ok }) =>
  readBackupRun({
    startedAt: ago(minutesAgo),
    endedAt: ago(minutesAgo),
    ok,
    report: { file: "optizzz.dump", bytes: 1, copied: null, error: ok ? null : "rclone", ...report },
  });

describe("serverHealth", () => {
  it("takes each server's state from the latest pass that read it", () => {
    const runs = [
      ingest(36, [entry("s4", "failed"), entry("s5", "updated")]),
      ingest(96, [entry("s4", "updated"), entry("s5", "failed")]),
    ];
    expect(serverHealth(SERVERS, runs, NOW).map((s) => [s.name, s.state, s.failures])).toEqual([
      ["S4", "failing", 1],
      ["S5", "ok", 1],
    ]);
  });

  it("counts only the last 24 hours, and calls a server read by none of them missing", () => {
    const runs = [ingest(36, [entry("s5", "unchanged")]), ingest(25 * 60, [entry("s4", "failed")])];
    const [s4, s5] = serverHealth(SERVERS, runs, NOW);
    expect(s4).toMatchObject({ state: "missing", last: null, failures: 0 });
    expect(s5?.last).toMatchObject({ status: "unchanged", at: ago(36) });
  });

  it("skips a report it cannot read", () => {
    const run = readIngestRun({ startedAt: ago(10), endedAt: ago(9), ok: true, report: { what: "else" } });
    expect(run.report).toBeNull();
    expect(serverHealth(SERVERS, [run], NOW)[0]?.state).toBe("missing");
  });
});

describe("jobAlerts", () => {
  const healthy = (runs = [ingest(36, [entry("s4", "updated"), entry("s5", "unchanged")])]) => ({
    health: serverHealth(SERVERS, runs, NOW),
    lastIngest: runs[0],
  });

  it("is empty when the cron and the backup are on time", () => {
    expect(jobAlerts({ ...healthy(), lastBackup: backup(9 * 60, true), now: NOW })).toEqual([]);
  });

  it("names a missed pass, a failing server and pages not rebuilt", () => {
    expect(jobAlerts({ ...healthy([ingest(80, [])]), lastBackup: backup(60, true), now: NOW })).toEqual([
      "Le cron n'a pas tourné depuis plus d'une heure.",
      "S4 : aucun passage depuis 24 h.",
      "S5 : aucun passage depuis 24 h.",
    ]);
    const failing = healthy([ingest(10, [entry("s4", "failed"), entry("s5", "updated")], false)]);
    expect(jobAlerts({ ...failing, lastBackup: backup(60, true), now: NOW })).toEqual([
      "Le dernier passage n'a pas pu reconstruire les pages du site.",
      "S4 : le dernier passage a échoué.",
    ]);
  });

  it("tells a backup kept on the VPS only from one that failed, and a missed night", () => {
    const at = (b: ReturnType<typeof backup> | undefined) => jobAlerts({ ...healthy(), lastBackup: b, now: NOW });
    expect(at(backup(60, false))).toEqual(["La dernière sauvegarde est sur le VPS mais pas dans le bucket Scaleway."]);
    expect(at(backup(60, false, { file: null, bytes: null, error: "pg_dump" }))).toEqual([
      "La dernière sauvegarde a échoué (pg_dump).",
    ]);
    expect(at(backup(27 * 60, true))).toEqual(["Pas de sauvegarde depuis plus d'une nuit."]);
    expect(at(undefined)).toEqual(["Aucune sauvegarde enregistrée."]);
  });
});

describe("formats", () => {
  it("writes a run's duration", () => {
    expect([400, 18_200, 134_000, 600_000].map(formatRunDuration)).toEqual([
      "0 s",
      "18 s",
      "2 min 14 s",
      "10 min 00 s",
    ]);
  });

  it("writes a size in Mo, then Go", () => {
    expect([12_000, 48_400_000, 1_820_000_000].map(formatBytes)).toEqual(["1 Mo", "48 Mo", "1,8 Go"]);
  });
});
