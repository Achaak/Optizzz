import { formatNumber } from "@optizzz/game/format/number-format";
import { formatPastTime } from "@optizzz/game/format/time-format";
import { SERVERS, serverById } from "@optizzz/game/servers";
import type { Metadata } from "next";
import Link from "next/link";
import { Histogram } from "~/components/bars";
import { PageHeader, Panel } from "~/components/panel";
import { Stat, StatGrid } from "~/components/stat";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { dailyCounts, discordAlerts } from "~/lib/admin/overview";
import { loadJobs, requireAdmin } from "~/server/admin";
import { db } from "~/server/db";
import { AlertList, alertsTitle } from "./alerts";

// The back office's overview (docs/features/site-back-office.md): accounts, spaces and what needs a look. Counts and
// dates only: what the spaces hold is encrypted and stays so.

// No title of its own: the 404 shown to anyone else must not name the back office.
export const metadata: Metadata = { robots: { index: false } };

/** Column heads in small mono capitals, as on « Votre compte ». */
const HEAD = "[&_th]:h-auto [&_th]:py-2 [&_th]:text-xs [&_th]:font-medium [&_th]:text-muted-foreground";
const ROW = "grid grid-cols-[repeat(auto-fit,minmax(min(480px,100%),1fr))] gap-5";
const DAY = 24 * 60 * 60_000;
/** Days of the new accounts' chart. */
const SIGNUP_DAYS = 14;

const serverName = (id: string) => serverById(id)?.name ?? id;

export default async function AdminOverviewPage() {
  await requireAdmin();
  const now = new Date();
  const ago = (days: number) => new Date(now.getTime() - days * DAY);
  const [
    jobs,
    accounts,
    weekAccounts,
    signups,
    extensions,
    players,
    spaces,
    demandes,
    staleDemandes,
    joins,
    refusals,
    suspensions,
  ] = await Promise.all([
    loadJobs(now),
    db.user.count(),
    db.user.count({ where: { createdAt: { gte: ago(7) } } }),
    db.user.findMany({ where: { createdAt: { gte: ago(SIGNUP_DAYS) } }, select: { createdAt: true } }),
    db.extensionToken.groupBy({ by: ["browser"], _count: { _all: true }, orderBy: { browser: "asc" } }),
    db.declaredPlayer.groupBy({ by: ["server"], _count: { _all: true } }),
    db.space.groupBy({ by: ["server"], _count: { _all: true } }),
    db.demande.count({ where: { status: { in: ["pending", "validated"] } } }),
    db.demande.count({ where: { status: "pending", createdAt: { lt: ago(1) } } }),
    db.joinRequest.count({ where: { status: "pending" } }),
    db.spaceDiscord.findMany({
      where: { refusedStatus: { not: null } },
      select: { refusedStatus: true, space: { select: { name: true, server: true } } },
    }),
    db.spaceReminders.findMany({
      where: { suspendedStatus: { not: null } },
      select: { suspendedStatus: true, space: { select: { name: true, server: true } } },
    }),
  ]);
  const alerts = [
    ...jobs.alerts,
    ...discordAlerts([
      ...refusals.map((r) => ({
        space: r.space.name,
        server: serverName(r.space.server),
        refusedStatus: r.refusedStatus,
        suspendedStatus: null,
      })),
      ...suspensions.map((r) => ({
        space: r.space.name,
        server: serverName(r.space.server),
        refusedStatus: null,
        suspendedStatus: r.suspendedStatus,
      })),
    ]),
  ];
  const sum = (rows: readonly { _count: { _all: number } }[]) => rows.reduce((total, r) => total + r._count._all, 0);
  const byServer = (rows: readonly { server: string; _count: { _all: number } }[], id: string) =>
    rows.find((r) => r.server === id)?._count._all ?? 0;
  const lastBackup = jobs.backups[0];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        kicker="Back office · vue d'ensemble"
        title={alertsTitle(alerts)}
        live={`relu ${formatPastTime(now, now)}`}
      >
        <p>
          {jobs.lastIngest
            ? `Dernier passage du cron ${formatPastTime(jobs.lastIngest.startedAt, now)}`
            : "Aucun passage du cron enregistré"}
          {lastBackup
            ? `, dernière sauvegarde ${formatPastTime(lastBackup.startedAt, now)}.`
            : ", aucune sauvegarde enregistrée."}{" "}
          <Link href="/admin/collecte" className="text-primary underline">
            Collecte et sauvegardes
          </Link>
        </p>
      </PageHeader>

      <AlertList alerts={alerts} />

      <StatGrid label="Comptes et Espaces">
        <Stat
          label="Comptes Optizzz"
          value={formatNumber(accounts)}
          hint={`+${formatNumber(weekAccounts)} en 7 jours`}
        />
        <Stat
          label="Extensions liées"
          value={formatNumber(sum(extensions))}
          hint={extensions.map((e) => `${e.browser} ${formatNumber(e._count._all)}`).join(" · ") || "aucune"}
        />
        <Stat label="Joueurs rattachés" value={formatNumber(sum(players))} hint="un par compte et par serveur" />
        <Stat label="Espaces d'alliance" value={formatNumber(sum(spaces))} />
        <Stat
          label="Demandes en cours"
          value={formatNumber(demandes)}
          hint={`${formatNumber(staleDemandes)} en attente depuis plus de 24 h`}
        />
        <Stat label="Adhésions en attente" value={formatNumber(joins)} hint="à accepter par un Admin" />
      </StatGrid>

      <div className={ROW}>
        <Panel
          title={`Nouveaux comptes, ${String(SIGNUP_DAYS)} jours`}
          aside={<span className="text-xs text-muted-foreground">par jour, heure de Paris</span>}
        >
          <Histogram
            label="Nouveaux comptes par jour"
            bars={dailyCounts(
              signups.map((u) => u.createdAt),
              now,
              SIGNUP_DAYS,
            )}
          />
        </Panel>

        <Panel flush title="Par serveur">
          <div className="overflow-x-auto">
            <Table className="text-[0.8125rem]">
              <TableHeader className={HEAD}>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-4">Serveur</TableHead>
                  <TableHead className="text-right">Joueurs rattachés</TableHead>
                  <TableHead className="pr-4 text-right">Espaces</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {SERVERS.map((server) => (
                  <TableRow key={server.id}>
                    <TableCell className="pl-4 font-heading text-lg font-bold">{server.name}</TableCell>
                    <TableCell className="text-right">{formatNumber(byServer(players, server.id))}</TableCell>
                    <TableCell className="pr-4 text-right">{formatNumber(byServer(spaces, server.id))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Panel>
      </div>
    </div>
  );
}
