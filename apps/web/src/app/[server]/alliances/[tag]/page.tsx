import { allianceSchema } from "@optizzz/game/exports";
import { formatDecimal, formatNumber } from "@optizzz/game/format/number-format";
import { dayMonth } from "@optizzz/game/format/time-format";
import { cn } from "cn";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { AdSlot } from "~/components/ad-slot";
import { ValueBars } from "~/components/bars";
import { PlusIcon } from "~/components/icons";
import { AllianceCrest } from "~/components/alliance-crest";
import { JournalList } from "~/components/journal-list";
import { MembersTable, type MemberRow } from "~/components/members-table";
import { SmallLabel, PageHeader, Panel, PanelLink } from "~/components/panel";
import { ScoreChart } from "~/components/score-chart";
import { Stat, StatGrid } from "~/components/stat";
import { CopyLinkButton } from "~/components/tools/copy-link-button";
import { buttonVariants } from "~/components/ui/button";
import { serverOfPath } from "~/lib/game-server";
import { ordinal, percentOf, trendText } from "~/lib/server-stats";
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

/** « PNA », « Pacte De Non Attaque »: the pact's kind, which the alliances write as they like. */
function isNonAggression(kind: string): boolean {
  return /\bPNA\b|non[- ]?(agression|attaque)/i.test(kind);
}

const outline = buttonVariants({ variant: "outline", size: "lg" });

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
  const { members, days, journal, rank, ranks, weekAgo, masters, serverField } = await alliancePage(
    server.id,
    alliance.tag,
    alliance.totalField,
  );
  const diplomacy = diplomacySchema.parse(alliance.diplomacy);
  const points = (pick: (day: (typeof days)[number]) => number) =>
    days.map((day) => ({ day: dayMonth(day.day), value: Math.round(pick(day)) }));
  const allianceHref = (other: string) => `/${server.id}/alliances/${encodeURIComponent(other)}`;
  const weekBefore = days.at(-8);
  const week = (text: string | undefined) => (text ? `${text} en 7 jours` : undefined);
  const colonized = members.filter((member) => member.masterId !== null).length;
  const memberRows: MemberRow[] = members.map((member) => {
    const before = weekAgo.get(member.id);
    const masterPseudo = member.masterId === null ? undefined : masters.get(member.masterId);
    return {
      id: member.id,
      pseudo: member.pseudo,
      x: member.x,
      y: member.y,
      field: member.field,
      building: member.buildingScore,
      technology: member.technologyScore,
      trophy: member.trophyScore,
      week: trendText(before, member.field),
      master: member.masterId !== null && masterPseudo ? { id: member.masterId, pseudo: masterPseudo } : null,
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        kicker={`Alliance · ${server.name}`}
        title={
          <span className="inline-flex items-center gap-4">
            <AllianceCrest tag={alliance.tag} size="lg" />
            {alliance.name.trim() ? `${alliance.tag} · ${alliance.name.trim()}` : alliance.tag}
          </span>
        }
        actions={
          <>
            <Link href={`/${server.id}/map?alliance=${encodeURIComponent(alliance.tag)}`} className={outline}>
              Voir sur la carte
            </Link>
            <Link
              href={`/${server.id}/compare?type=alliances&ids=${encodeURIComponent(alliance.tag)}`}
              className={outline}
            >
              <PlusIcon />
              Comparer
            </Link>
            <CopyLinkButton />
          </>
        }
      >
        {formatNumber(alliance.playersCount)} membres · {ordinal(rank)} alliance au TDC
      </PageHeader>

      <StatGrid label="Chiffres de l'alliance">
        <Stat
          label="TDC"
          value={formatNumber(alliance.totalField)}
          hint={`cm² · ${formatDecimal(percentOf(alliance.totalField, serverField))} % du serveur`}
        />
        <Stat
          label="Rang"
          value={ordinal(rank)}
          hint={week(trendText(ranks.at(-8)?.rank, rank, true)) ?? "au TDC sur le serveur"}
        />
        <Stat
          label="Membres"
          value={formatNumber(alliance.playersCount)}
          hint={week(trendText(weekBefore?.playersCount, alliance.playersCount))}
        />
        <Stat
          label="TDC moyen"
          value={formatNumber(alliance.playersCount > 0 ? Math.round(alliance.totalField / alliance.playersCount) : 0)}
          hint="par membre"
        />
        <Stat label="Colonisés" value={formatNumber(colonized)} hint="membres sous colonie" />
      </StatGrid>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Diplomatie">
          {diplomacy.pacts.length === 0 && diplomacy.wars.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ni pacte ni guerre dans l&apos;export.</p>
          ) : (
            <div className="space-y-3 text-sm">
              {diplomacy.pacts.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <SmallLabel className="w-20">Pactes</SmallLabel>
                  {diplomacy.pacts.map((pact, index) => {
                    const kind = pact.name.trim();
                    return (
                      <Link
                        // The export can list a tag twice.
                        key={`${pact.tag}-${String(index)}`}
                        href={allianceHref(pact.tag)}
                        title={kind || undefined}
                        className={cn(
                          "max-w-full truncate px-2 py-0.5 font-mono text-xs hover:underline sm:max-w-64",
                          // A non-aggression pact binds less: neutral, and its kind is written next to it.
                          isNonAggression(kind) ? "bg-raised text-foreground" : "bg-accent text-primary",
                        )}
                      >
                        {pact.tag}
                        {kind && ` · ${kind}`}
                      </Link>
                    );
                  })}
                </div>
              )}
              {diplomacy.wars.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <SmallLabel className="w-20">Guerres</SmallLabel>
                  {diplomacy.wars.map((war, index) => (
                    <Link
                      key={`${war}-${String(index)}`}
                      href={allianceHref(war)}
                      className="bg-info-soft px-2 py-0.5 font-mono text-xs text-info hover:underline"
                    >
                      <span aria-hidden>⚔ </span>
                      {war}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </Panel>
        <Panel title="TDC de chaque membre" aside={<span className="text-xs text-muted-foreground">cm²</span>}>
          <ValueBars
            tone="amber"
            rows={members.slice(0, 8).map((member) => ({
              key: String(member.id),
              label: member.pseudo,
              href: `/${server.id}/players/${String(member.id)}`,
              value: member.field,
              text: formatNumber(member.field),
            }))}
          />
          {members.length > 8 && (
            <p className="mt-3 text-xs text-muted-foreground">
              8 premiers sur {formatNumber(members.length)} · le tableau ci-dessous les montre tous
            </p>
          )}
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="TDC de l'alliance">
          <ScoreChart label="TDC (cm²)" unit="cm² de TDC" points={points((day) => day.totalField)} />
        </Panel>
        <Panel title="Rang au TDC">
          <ScoreChart
            label="Rang"
            unit="ᵉ au TDC"
            tone="blue"
            reversed
            points={ranks.map((row) => ({ day: dayMonth(row.day), value: row.rank }))}
          />
        </Panel>
      </div>

      <AdSlot />

      <MembersTable server={server.id} members={memberRows} />

      <Panel
        flush
        title={`Journal de ${alliance.tag}`}
        aside={
          <PanelLink href={`/${server.id}/journal?q=${encodeURIComponent(alliance.tag)}`}>Tout le Journal</PanelLink>
        }
      >
        <JournalList server={server.id} lines={journal.slice(0, 20)} named={false} />
      </Panel>
    </div>
  );
}
