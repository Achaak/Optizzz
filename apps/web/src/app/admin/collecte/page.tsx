import { versionDate } from "@optizzz/game/export-versions";
import { formatNumber } from "@optizzz/game/format/number-format";
import { formatDateTime, formatPastTime } from "@optizzz/game/format/time-format";
import { SERVERS, serverById } from "@optizzz/game/servers";
import type { Metadata } from "next";
import { PageHeader, Panel } from "~/components/panel";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { formatBytes, formatRunDuration, type IngestReport, type Run, type ServerState } from "~/lib/admin/job-runs";
import { loadJobs, requireAdmin } from "~/server/admin";
import { db } from "~/server/db";
import { AlertList, alertsTitle } from "../alerts";

// The back office (docs/features/site-back-office.md): the hourly cron and the nightly backups.

// No title of its own: the 404 shown to anyone else must not name the back office.
export const metadata: Metadata = { robots: { index: false } };

/** Column heads in small mono capitals, as on « Votre compte ». */
const HEAD =
  "[&_th]:h-auto [&_th]:py-2 [&_th]:font-mono [&_th]:text-[0.6875rem] [&_th]:font-medium [&_th]:tracking-widest [&_th]:text-muted-foreground [&_th]:uppercase";
const ROW = "grid grid-cols-[repeat(auto-fit,minmax(min(480px,100%),1fr))] gap-5";
/** A state is told by its sign and its words, never by its color alone (docs/adr/0003-daltonisme.md). */
const STATE: Record<ServerState, { label: string; className: string }> = {
  ok: { label: "● à jour", className: "bg-accent text-primary" },
  failing: { label: "▲ échec", className: "border border-foreground" },
  missing: { label: "○ aucun passage", className: "border border-dashed border-muted-foreground" },
};
const serverName = (id: string) => serverById(id)?.name ?? id;

/** What a pass did, in one line: the servers that failed and why, or what it wrote. */
function runNote(run: Run<IngestReport>): string {
  const report = run.report;
  if (!report) return "compte rendu illisible";
  const failed = report.servers.filter((s) => s.status === "failed");
  const notes = failed.map((s) => `${serverName(s.server)} : ${s.error ?? "échec"}`);
  if (report.revalidated === false) notes.push("pages du site non reconstruites");
  if (notes.length > 0) return notes.join(" · ");
  const changes = report.servers.reduce((sum, s) => sum + s.changes, 0);
  const updated = report.servers.filter((s) => s.status === "updated").length;
  return updated === 0
    ? "aucun nouvel export"
    : `${formatNumber(updated)} serveur${updated > 1 ? "s" : ""} relu${updated > 1 ? "s" : ""} · ${formatNumber(changes)} entrées de Journal`;
}

export default async function CollectPage() {
  await requireAdmin();
  const now = new Date();
  const [{ lastDay, lastIngest, backups, health, alerts }, reads, maps, players, [size]] = await Promise.all([
    loadJobs(now),
    db.exportRead.findMany(),
    db.mapFile.findMany({ select: { server: true, updatedAt: true } }),
    db.player.groupBy({ by: ["server"], _count: { _all: true } }),
    db.$queryRaw<[{ bytes: bigint }]>`SELECT pg_database_size(current_database()) AS bytes`,
  ]);
  const readOf = (server: string, kind: string) => reads.find((r) => r.server === server && r.kind === kind)?.version;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        kicker="Back office · collecte et sauvegardes"
        title={alertsTitle(alerts)}
        note={`relu ${formatPastTime(now, now)}`}
      >
        <p>
          {lastIngest
            ? `Dernier passage du cron ${formatPastTime(lastIngest.startedAt, now)}, en ${formatRunDuration(lastIngest.endedAt.getTime() - lastIngest.startedAt.getTime())}.`
            : "Le cron n'a encore enregistré aucun passage."}{" "}
          Il relit chaque heure l&apos;export public des {formatNumber(SERVERS.length)} serveurs, puis reconstruit les
          pages du site.
        </p>
      </PageHeader>

      <AlertList alerts={alerts} />

      <Panel
        flush
        title="Par serveur"
        aside={<span className="text-xs text-muted-foreground">exports lus et dernier passage, sur 24 h</span>}
      >
        <div className="overflow-x-auto">
          <Table className="text-[0.8125rem]">
            <TableHeader className={HEAD}>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4">Serveur</TableHead>
                <TableHead>État</TableHead>
                <TableHead>Export joueurs</TableHead>
                <TableHead>Export alliances</TableHead>
                <TableHead className="text-right">Joueurs</TableHead>
                <TableHead className="text-right">Journal, 24 h</TableHead>
                <TableHead className="text-right">Échecs, 24 h</TableHead>
                <TableHead>Carte</TableHead>
                <TableHead className="pr-4 text-right">Durée</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {health.map((server) => {
                const playersRead = readOf(server.server, "players");
                const alliancesRead = readOf(server.server, "alliances");
                const map = maps.find((m) => m.server === server.server);
                const count = players.find((p) => p.server === server.server)?._count._all;
                const journal = lastDay.reduce(
                  (sum, run) => sum + (run.report?.servers.find((s) => s.server === server.server)?.changes ?? 0),
                  0,
                );
                return (
                  <TableRow key={server.server}>
                    <TableCell className="pl-4 font-heading text-lg font-bold">{server.name}</TableCell>
                    <TableCell>
                      <span
                        className={`whitespace-nowrap px-2 py-0.5 font-mono text-xs ${STATE[server.state].className}`}
                      >
                        {STATE[server.state].label}
                      </span>
                      {server.state === "failing" && server.last?.error && (
                        <span className="mt-1 block max-w-64 text-xs text-muted-foreground">{server.last.error}</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono whitespace-nowrap">
                      {playersRead ? formatDateTime(versionDate(playersRead)) : "—"}
                    </TableCell>
                    <TableCell className="font-mono whitespace-nowrap">
                      {alliancesRead ? formatDateTime(versionDate(alliancesRead)) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {count === undefined ? "—" : formatNumber(count)}
                    </TableCell>
                    <TableCell className="text-right font-mono">{formatNumber(journal)}</TableCell>
                    <TableCell className="text-right font-mono">{formatNumber(server.failures)}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {map ? formatPastTime(map.updatedAt, now) : "—"}
                    </TableCell>
                    <TableCell className="pr-4 text-right font-mono">
                      {server.last ? formatRunDuration(server.last.ms) : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Panel>

      <div className={ROW}>
        <Panel
          flush
          title="Passages du cron"
          aside={<span className="text-xs text-muted-foreground">les 24 dernières heures</span>}
        >
          {lastDay.length > 0 ? (
            <div className="overflow-x-auto">
              <Table className="text-[0.8125rem]">
                <TableHeader className={HEAD}>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-4">Début</TableHead>
                    <TableHead>Résultat</TableHead>
                    <TableHead className="text-right">Durée</TableHead>
                    <TableHead className="pr-4">Note</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lastDay.map((run) => (
                    <TableRow key={run.startedAt.toISOString()}>
                      <TableCell className="pl-4 font-mono whitespace-nowrap">
                        {formatPastTime(run.startedAt, now)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{run.ok ? "✓ complet" : "× échec"}</TableCell>
                      <TableCell className="text-right font-mono whitespace-nowrap">
                        {formatRunDuration(run.endedAt.getTime() - run.startedAt.getTime())}
                      </TableCell>
                      <TableCell className="min-w-56 pr-4 whitespace-normal text-muted-foreground">
                        {runNote(run)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="px-4 py-3.5 text-muted-foreground">Aucun passage enregistré.</p>
          )}
        </Panel>

        <Panel
          flush
          title="Sauvegardes"
          aside={
            <span className="text-xs text-muted-foreground">chaque nuit · 7 jours sur le VPS, 30 dans le bucket</span>
          }
        >
          {backups.length > 0 ? (
            <div className="overflow-x-auto">
              <Table className="text-[0.8125rem]">
                <TableHeader className={HEAD}>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-4">Quand</TableHead>
                    <TableHead className="text-right">Taille</TableHead>
                    <TableHead>VPS</TableHead>
                    <TableHead className="pr-4">Scaleway</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {backups.map((run) => {
                    const report = run.report;
                    return (
                      <TableRow key={run.startedAt.toISOString()}>
                        <TableCell className="pl-4 font-mono whitespace-nowrap">
                          {formatPastTime(run.startedAt, now)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {report?.bytes == null ? "—" : formatBytes(report.bytes)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {report?.file ? "✓ gardée" : `× échec${report?.error ? ` (${report.error})` : ""}`}
                        </TableCell>
                        <TableCell className="pr-4 whitespace-nowrap">
                          {report?.copied === true
                            ? "✓ copiée"
                            : report?.copied === false
                              ? "× copie échouée"
                              : "— sans bucket"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="px-4 py-3.5 text-muted-foreground">Aucune sauvegarde enregistrée.</p>
          )}
          <p className="border-t px-4 py-3 text-[0.8125rem] text-muted-foreground">
            Base de données&nbsp;: <span className="font-mono text-foreground">{formatBytes(Number(size.bytes))}</span>.
          </p>
        </Panel>
      </div>
    </div>
  );
}
