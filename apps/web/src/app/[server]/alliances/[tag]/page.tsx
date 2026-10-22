import { allianceSchema } from "@optizzz/game/exports";
import { formatNumber } from "@optizzz/game/format/number-format";
import { dayMonth } from "@optizzz/game/format/time-format";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { JournalList } from "~/components/journal-list";
import { ScoreChart } from "~/components/score-chart";
import { Stat } from "~/components/stat";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { serverOfPath } from "~/lib/game-server";
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
  const { members, days, journal } = await alliancePage(server.id, alliance.tag);
  const diplomacy = diplomacySchema.parse(alliance.diplomacy);
  const points = (pick: (day: (typeof days)[number]) => number) =>
    days.map((day) => ({ day: dayMonth(day.day), value: pick(day) }));
  const allianceLink = (other: string) => (
    <Link href={`/${server.id}/alliances/${encodeURIComponent(other)}`} className="hover:underline">
      {other}
    </Link>
  );

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {alliance.tag} <span className="font-normal text-muted-foreground">{alliance.name.trim()}</span>
        </h1>
      </header>

      <section aria-label="Totaux" className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="Membres" value={formatNumber(alliance.playersCount)} />
        <Stat label="TDC (cm²)" value={formatNumber(alliance.totalField)} />
        <Stat label="Fourmilière" value={formatNumber(alliance.totalBuildingScore)} />
        <Stat label="Technologie" value={formatNumber(alliance.totalTechnologyScore)} />
        <Stat label="Combat" value={formatNumber(alliance.totalTrophyScore)} />
      </section>

      {(diplomacy.pacts.length > 0 || diplomacy.wars.length > 0) && (
        <section aria-label="Diplomatie" className="space-y-2 text-sm">
          {diplomacy.pacts.length > 0 && (
            <p className="flex flex-wrap items-center gap-2">
              <span>Pactes :</span>
              {diplomacy.pacts.map((pact) => (
                <Badge key={pact.tag} variant="secondary">
                  {allianceLink(pact.tag)} · {pact.name.trim()}
                </Badge>
              ))}
            </p>
          )}
          {diplomacy.wars.length > 0 && (
            <p className="flex flex-wrap items-center gap-2">
              <span>Guerres déclarées :</span>
              {diplomacy.wars.map((war) => (
                <Badge key={war} variant="outline">
                  {allianceLink(war)}
                </Badge>
              ))}
            </p>
          )}
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>TDC, jour après jour</CardTitle>
          </CardHeader>
          <CardContent>
            <ScoreChart label="TDC" points={points((day) => day.totalField)} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Membres, jour après jour</CardTitle>
          </CardHeader>
          <CardContent>
            <ScoreChart label="Membres" points={points((day) => day.playersCount)} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Membres</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Joueur</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead className="text-right">TDC</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <Link href={`/${server.id}/joueurs/${String(member.id)}`} className="hover:underline">
                        {member.pseudo}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{member.grade ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(member.field)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Changements</CardTitle>
          </CardHeader>
          <CardContent>
            <JournalList server={server.id} lines={journal} named={false} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
