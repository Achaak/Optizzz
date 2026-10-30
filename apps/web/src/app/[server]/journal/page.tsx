import { formatNumber } from "@optizzz/game/format/number-format";
import { dayMonth, formatDateTime } from "@optizzz/game/format/time-format";
import type { Metadata } from "next";
import { AdSlot } from "~/components/ad-slot";
import { JournalActivityChart } from "~/components/journal-activity-chart";
import { JournalList } from "~/components/journal-list";
import { ChoiceLinks, FilterBar, FilterField, queryHref } from "~/components/list-parts";
import { MonoLabel, PageHeader, Panel } from "~/components/panel";
import { Pager } from "~/components/pager";
import { Stat } from "~/components/stat";
import { Input } from "~/components/ui/input";
import { pageOf, serverOfPath, textOf } from "~/lib/game-server";
import { JOURNAL_GROUPS, journalGroupFrom, parisDayRange } from "~/lib/server-stats";
import { journalPage, journalPerDay, lastReading, PAGE_SIZE, type JournalLine } from "~/server/queries";

interface Props {
  params: Promise<{ server: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const server = serverOfPath((await params).server, "/journal");
  return {
    title: `Journal de ${server.name}`,
    description: `Arrivées, départs, colonisations, pactes et guerres du serveur ${server.name} de Fourmizzz, heure par heure.`,
  };
}

/** The lines of one reading of the export: they share its time. */
function byReading(lines: JournalLine[]): { at: Date; lines: JournalLine[] }[] {
  const readings: { at: Date; lines: JournalLine[] }[] = [];
  for (const line of lines) {
    const last = readings.at(-1);
    if (last?.at.getTime() === line.at.getTime()) last.lines.push(line);
    else readings.push({ at: line.at, lines: [line] });
  }
  return readings;
}

const plural = (count: number, one: string, many: string) => `${formatNumber(count)} ${count > 1 ? many : one}`;

export default async function JournalPage({ params, searchParams }: Props) {
  const server = serverOfPath((await params).server, "/journal");
  const query = await searchParams;
  const group = journalGroupFrom(query.groupe);
  const q = textOf(query.q);
  const dayText = textOf(query.jour);
  const day = parisDayRange(dayText);
  const page = pageOf(query.page);
  const [reading, days, { total, lines }] = await Promise.all([
    lastReading(server.id),
    journalPerDay(server.id),
    journalPage(server.id, { group, q, day, page }),
  ]);
  const path = `/${server.id}/journal`;
  const kept = { groupe: group ?? "", q, jour: day ? dayText : "" };
  const lastDay = days.at(-1);
  const filtered = group !== null || q !== "" || day !== null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Journal de ${server.name}`}
        note={reading ? `Dernier relevé ${formatDateTime(reading)}` : undefined}
      >
        Ce qui change d&apos;une heure à l&apos;autre, gardé pour toujours. Les variations de TDC et des scores sont
        dans les courbes.
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Panel
          title="Changements par jour"
          aside={<span className="text-xs text-muted-foreground">30 derniers jours</span>}
        >
          <JournalActivityChart points={days.map(({ day: date, ...groups }) => ({ day: dayMonth(date), ...groups }))} />
        </Panel>
        {lastDay && (
          <Panel flush title={`Le ${dayMonth(lastDay.day)}`}>
            <div
              role="group"
              aria-label={`Changements du ${dayMonth(lastDay.day)}`}
              className="grid grid-cols-2 [&>*:nth-child(2n)]:border-r-0 [&>*:nth-last-child(-n+2)]:border-b-0"
            >
              {JOURNAL_GROUPS.map((entry) => (
                <Stat key={entry.id} label={entry.label} value={formatNumber(lastDay[entry.id])} />
              ))}
            </div>
          </Panel>
        )}
      </div>

      <div className="border bg-card">
        <div className="border-b px-4 py-3">
          <ChoiceLinks
            label="Voir"
            choices={["all", ...JOURNAL_GROUPS.map((entry) => entry.id)] as const}
            current={group ?? "all"}
            text={(choice) => JOURNAL_GROUPS.find((entry) => entry.id === choice)?.label ?? "Tout"}
            href={(choice) => queryHref(path, { ...kept, groupe: choice === "all" ? "" : choice })}
          />
        </div>
        <FilterBar action={path} count={total === 0 ? "Aucun changement" : plural(total, "changement", "changements")}>
          {group && <input type="hidden" name="groupe" value={group} />}
          <FilterField label="Joueur ou alliance">
            <Input name="q" defaultValue={q} placeholder="Une partie du nom" className="h-9 w-48" />
          </FilterField>
          <FilterField label="Jour">
            <Input type="date" name="jour" defaultValue={day ? dayText : ""} className="h-9 w-40" />
          </FilterField>
        </FilterBar>
        {lines.length > 0 ? (
          byReading(lines).map((reading) => (
            <section key={reading.at.getTime()} aria-label={`Relevé du ${formatDateTime(reading.at)}`}>
              <h2 className="border-b bg-muted px-4 py-1.5">
                <MonoLabel>{formatDateTime(reading.at)}</MonoLabel>
              </h2>
              <JournalList server={server.id} lines={reading.lines} named timed={false} />
            </section>
          ))
        ) : (
          <p className="p-4 text-sm text-muted-foreground">
            {filtered ? "Aucun changement ne correspond." : "Aucun changement noté depuis le premier relevé du site."}
          </p>
        )}
        <AdSlot className="border-t px-4 pt-3" />
        <Pager path={path} query={kept} page={page} pages={Math.ceil(total / PAGE_SIZE)} />
      </div>
    </div>
  );
}
