import { allianceSchema } from "@optizzz/game/exports";
import { formatNumber } from "@optizzz/game/format/number-format";
import { dayMonth } from "@optizzz/game/format/time-format";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { JournalList } from "~/components/journal-list";
import { MonoLabel, PageHeader, Panel, PanelLink } from "~/components/panel";
import { ScoreChart } from "~/components/score-chart";
import { Stat, StatGrid } from "~/components/stat";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { serverOfPath } from "~/lib/game-server";
import { ordinal, percentOf } from "~/lib/server-stats";
import { alliancePage, findAlliance } from "~/server/queries";

export const revalidate = 3600;
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

interface Props {
  params: Promise<{ server: string; tag: string }>;
}

const diplomacySchema = allianceSchema.shape.diplomacy;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { server: segment, tag } = await params;
  const server = serverOfPath(segment, `/alliances/${tag}`);
  const alliance = await findAlliance(server.id, decodeURIComponent(tag));
  return { title: alliance ? `${alliance.tag} (${server.name})` : "Alliance inconnue", robots: { index: false } };
}

export default async function AlliancePage({ params }: Props) {
  const { server: segment, tag: encoded } = await params;
  const tag = decodeURIComponent(encoded);
  const server = serverOfPath(segment, `/alliances/${encoded}`);
  const alliance = await findAlliance(server.id, tag);
  if (!alliance) notFound();
  // The export's own case for the tag: « /s5/alliances/abc » goes to « …/ABC ».
  if (alliance.tag !== tag) permanentRedirect(`/${server.id}/alliances/${encodeURIComponent(alliance.tag)}`);
  const { members, days, journal, rank, ranks } = await alliancePage(server.id, alliance.tag, alliance.totalField);
  const diplomacy = diplomacySchema.parse(alliance.diplomacy);
  const points = (pick: (day: (typeof days)[number]) => number) =>
    days.map((day) => ({ day: dayMonth(day.day), value: Math.round(pick(day)) }));
  const allianceHref = (other: string) => `/${server.id}/alliances/${encodeURIComponent(other)}`;
  const topField = members[0]?.field ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <>
            {alliance.tag}{" "}
            <span className="font-sans text-2xl font-normal tracking-normal text-muted-foreground normal-case sm:text-3xl">
              {alliance.name.trim()}
            </span>
          </>
        }
        note={`Serveur ${server.name}`}
      >
        <PanelLink href={`/${server.id}/map?alliance=${encodeURIComponent(alliance.tag)}`}>Voir sur la carte</PanelLink>
      </PageHeader>

      <StatGrid label="Totaux">
        <Stat label="Membres" value={formatNumber(alliance.playersCount)} />
        <Stat label="TDC" value={formatNumber(alliance.totalField)} hint="cm²" />
        <Stat label="Rang" value={ordinal(rank)} hint="au TDC sur le serveur" />
        <Stat label="Fourmilière" value={formatNumber(alliance.totalBuildingScore)} />
        <Stat label="Technologie" value={formatNumber(alliance.totalTechnologyScore)} />
        <Stat label="Combat" value={formatNumber(alliance.totalTrophyScore)} />
      </StatGrid>

      {(diplomacy.pacts.length > 0 || diplomacy.wars.length > 0) && (
        <Panel title="Diplomatie">
          <div className="space-y-3 text-sm">
            {diplomacy.pacts.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <MonoLabel className="w-16 text-primary">Pactes</MonoLabel>
                {diplomacy.pacts.map((pact) => (
                  <Link key={pact.tag} href={allianceHref(pact.tag)} className="border px-2 py-1 hover:bg-accent">
                    <strong>{pact.tag}</strong> <span className="text-muted-foreground">· {pact.name.trim()}</span>
                  </Link>
                ))}
              </div>
            )}
            {diplomacy.wars.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <MonoLabel className="w-16 text-info">Guerres</MonoLabel>
                {diplomacy.wars.map((war) => (
                  <Link key={war} href={allianceHref(war)} className="border border-info/50 px-2 py-1 hover:bg-accent">
                    <strong>{war}</strong>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </Panel>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="TDC">
          <ScoreChart label="TDC (cm²)" unit="cm² de TDC" points={points((day) => day.totalField)} />
        </Panel>
        <Panel title="Rang au TDC" aside={<span className="text-xs text-muted-foreground">1 en haut</span>}>
          <ScoreChart
            label="Rang"
            unit="ᵉ au TDC"
            tone="blue"
            reversed
            points={ranks.map((row) => ({ day: dayMonth(row.day), value: row.rank }))}
          />
        </Panel>
        <Panel title="Membres">
          <ScoreChart label="Membres" unit="membres" points={points((day) => day.playersCount)} />
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel
          flush
          title="Membres"
          aside={<span className="text-xs text-muted-foreground">la barre : part du TDC de l&apos;alliance</span>}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 pl-4">#</TableHead>
                <TableHead>Joueur</TableHead>
                <TableHead className="hidden sm:table-cell">Grade</TableHead>
                <TableHead className="pr-4 text-right">TDC</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member, index) => (
                <TableRow key={member.id}>
                  <TableCell className="pl-4 font-mono text-primary">{index + 1}</TableCell>
                  <TableCell>
                    <Link href={`/${server.id}/players/${String(member.id)}`} className="font-semibold hover:underline">
                      {member.pseudo}
                    </Link>
                  </TableCell>
                  <TableCell className="hidden max-w-40 truncate text-muted-foreground sm:table-cell">
                    {member.grade ?? "—"}
                  </TableCell>
                  <TableCell className="pr-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="hidden h-2 w-24 sm:block" aria-hidden>
                        <div
                          className="ml-auto h-full bg-chart-1"
                          style={{ width: `${String(topField > 0 ? (member.field / topField) * 100 : 0)}%` }}
                        />
                      </div>
                      <span className="w-20 font-mono">{formatNumber(member.field)}</span>
                      <span className="hidden w-12 font-mono text-xs text-muted-foreground md:inline">
                        {String(Math.round(percentOf(member.field, alliance.totalField)))} %
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
        <Panel flush title="Changements">
          <JournalList server={server.id} lines={journal} named={false} />
        </Panel>
      </div>
    </div>
  );
}
