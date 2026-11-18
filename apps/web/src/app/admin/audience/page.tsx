import { formatNumber } from "@optizzz/game/format/number-format";
import { formatPastTime } from "@optizzz/game/format/time-format";
import { serverById } from "@optizzz/game/servers";
import type { Metadata } from "next";
import { Histogram } from "~/components/bars";
import { PageHeader, Panel } from "~/components/panel";
import { Stat, StatGrid } from "~/components/stat";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { audience } from "~/lib/admin/audience";
import { parisDay } from "~/lib/page-views";
import { requireAdmin } from "~/server/admin";
import { db } from "~/server/db";

// The back office's « Audience » (docs/features/site-audience.md): the page views counter, per day and per page. The
// counter keeps nothing about the visitors, so neither does this page.

// No title of its own: the 404 shown to anyone else must not name the back office.
export const metadata: Metadata = { robots: { index: false } };

const HEAD = "[&_th]:h-auto [&_th]:py-2 [&_th]:text-xs [&_th]:font-medium [&_th]:text-muted-foreground";
const ROW = "grid grid-cols-[repeat(auto-fit,minmax(min(480px,100%),1fr))] gap-5";
const DAY = 24 * 60 * 60_000;
/** Days of the page views' chart. */
const CHART_DAYS = 14;

export default async function AdminAudiencePage() {
  await requireAdmin();
  const now = new Date();
  const rows = await db.pageView.findMany({
    where: { day: { gt: new Date(parisDay(now).getTime() - 30 * DAY) } },
  });
  const a = audience(rows, now, CHART_DAYS);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader kicker="Back office · audience" title="Pages vues" live={`relu ${formatPastTime(now, now)}`}>
        <p>
          Une page vue est comptée quand une page du site s&apos;affiche dans un navigateur, robots exclus. Le compteur
          ne garde que le jour et la page : ni adresse IP, ni cookie, ni navigateur, ni ce que la page montre.
        </p>
      </PageHeader>

      <StatGrid label="Pages vues">
        <Stat label="Aujourd'hui" value={formatNumber(a.today)} hint="depuis minuit, heure de Paris" />
        <Stat label="7 jours" value={formatNumber(a.week)} hint={`${formatNumber(Math.round(a.week / 7))} par jour`} />
        <Stat label="30 jours" value={formatNumber(a.month)} />
        <Stat
          label="Lectures de la carte par l'extension"
          value={formatNumber(a.mapReads.week)}
          hint={`en 7 jours, ${formatNumber(a.mapReads.month)} en 30 jours`}
        />
      </StatGrid>

      <Panel
        title={`Pages vues, ${String(CHART_DAYS)} jours`}
        aside={<span className="text-xs text-muted-foreground">par jour, heure de Paris</span>}
      >
        <Histogram label="Pages vues par jour" bars={a.daily} />
      </Panel>

      <div className={ROW}>
        <Panel flush title="Par page">
          <div className="overflow-x-auto">
            <Table className="text-[0.8125rem]">
              <TableHeader className={HEAD}>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-4">Page</TableHead>
                  <TableHead className="text-right">7 jours</TableHead>
                  <TableHead className="pr-4 text-right">30 jours</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {a.pages.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="pl-4 text-muted-foreground">
                      Aucune page vue en 30 jours.
                    </TableCell>
                  </TableRow>
                )}
                {a.pages.map((p) => (
                  <TableRow key={p.page}>
                    <TableCell className="pl-4">{p.name}</TableCell>
                    <TableCell className="text-right">{formatNumber(p.week)}</TableCell>
                    <TableCell className="pr-4 text-right">{formatNumber(p.month)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Panel>

        <Panel
          flush
          title="Carte lue par l'extension"
          aside={<span className="text-xs text-muted-foreground">au plus une lecture par joueur et par 10 min</span>}
        >
          <div className="overflow-x-auto">
            <Table className="text-[0.8125rem]">
              <TableHeader className={HEAD}>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-4">Serveur</TableHead>
                  <TableHead className="text-right">7 jours</TableHead>
                  <TableHead className="pr-4 text-right">30 jours</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {a.mapReads.servers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="pl-4 text-muted-foreground">
                      Aucune lecture en 30 jours.
                    </TableCell>
                  </TableRow>
                )}
                {a.mapReads.servers.map((s) => (
                  <TableRow key={s.server}>
                    <TableCell className="pl-4 font-heading text-lg font-bold">
                      {serverById(s.server)?.name ?? s.server}
                    </TableCell>
                    <TableCell className="text-right">{formatNumber(s.week)}</TableCell>
                    <TableCell className="pr-4 text-right">{formatNumber(s.month)}</TableCell>
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
