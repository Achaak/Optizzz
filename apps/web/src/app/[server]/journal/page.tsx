import { formatNumber } from "@optizzz/game/format/number-format";
import { dayMonth, formatDateTime, parisParts } from "@optizzz/game/format/time-format";
import type { Metadata } from "next";
import Link from "next/link";
import { AdSlot } from "~/components/ad-slot";
import { JournalActivityChart } from "~/components/journal-activity-chart";
import { JournalList } from "~/components/journal-list";
import { ChoiceLinks, queryHref } from "~/components/list-parts";
import { SmallLabel, PageHeader, Panel } from "~/components/panel";
import { MIN_CURVE_DAYS } from "~/components/score-chart";
import { Stat, StatGrid } from "~/components/stat";
import { buttonVariants } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { pageOf, serverOfPath, textOf } from "~/lib/game-server";
import { JOURNAL_GROUPS, journalGroupFrom, parisDayRange } from "~/lib/server-stats";
import {
  journalPage,
  journalPerDay,
  lastReading,
  PAGE_SIZE,
  type JournalDay,
  type JournalLine,
} from "~/server/queries";

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

const WEEKDAYS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const MONTHS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

/** « Dimanche 26 octobre », Paris time. */
function longDay(date: Date): string {
  const { weekday, day, month } = parisParts(date);
  return `${WEEKDAYS[weekday] ?? ""} ${day === 1 ? "1er" : String(day)} ${MONTHS[month - 1] ?? ""}`;
}

/** « 2026-10-26 », the date field's value, of the Paris day of `date`. */
function dayValue(date: Date): string {
  const { year, month, day } = parisParts(date);
  return `${String(year)}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** « 9 h 00 », Paris time. */
function clock(date: Date): string {
  const { hours, minutes } = parisParts(date);
  return `${String(hours)} h ${String(minutes).padStart(2, "0")}`;
}

/** The day `offset` days after `value` (« 2026-10-26 »). */
function shiftDay(value: string, offset: number): string {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, (day ?? 1) + offset));
  return date.toISOString().slice(0, 10);
}

const total = (day: JournalDay) => JOURNAL_GROUPS.reduce((sum, group) => sum + day[group.id], 0);

const HINTS = {
  players: "arrivées, départs, pseudos, vacances",
  alliances: "créations, fins, changements d'alliance",
  colonies: "colonisations et libérations",
  diplomacy: "pactes, ruptures, guerres",
};

const MagnifierIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);

export default async function JournalPage({ params, searchParams }: Props) {
  const server = serverOfPath((await params).server, "/journal");
  const query = await searchParams;
  const group = journalGroupFrom(query.groupe);
  const q = textOf(query.q);
  const dayText = textOf(query.jour);
  const day = parisDayRange(dayText);
  const page = pageOf(query.page);
  const [reading, days, { total: count, lines }] = await Promise.all([
    lastReading(server.id),
    journalPerDay(server.id),
    journalPage(server.id, { group, q, day, page }),
  ]);
  const path = `/${server.id}/journal`;
  const kept = { groupe: group ?? "", q, jour: day ? dayText : "" };
  const filtered = group !== null || q !== "" || day !== null;
  const pages = Math.ceil(count / PAGE_SIZE);
  // The day the figures speak of: the one asked for, else the last one with a Change.
  const shown = day ? days.find((entry) => dayValue(entry.day) === dayText) : days.at(-1);
  const readings = byReading(lines);
  const today = reading ? dayValue(reading) : null;
  const dayHref = (value: string) => queryHref(path, { ...kept, jour: value });
  const previousDay = day ? shiftDay(dayText, -1) : null;
  const nextDay = day && today && shiftDay(dayText, 1) <= today ? shiftDay(dayText, 1) : null;
  const first = (page - 1) * PAGE_SIZE + 1;
  const pageHref = (target: number) => queryHref(path, { ...kept, page: target > 1 ? String(target) : "" });

  return (
    <div className="space-y-5">
      <PageHeader
        title={`Journal de ${server.name}`}
        live={reading ? `Dernier relevé ${formatDateTime(reading)} · relu chaque heure` : undefined}
      >
        Ce qui change d&apos;une heure à l&apos;autre, gardé pour toujours. Les variations de TDC et des scores sont
        dans les courbes.
      </PageHeader>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-[0.875rem] bg-card px-4.5 py-3.5 shadow-panel">
        <ChoiceLinks
          label="Voir"
          choices={["all", ...JOURNAL_GROUPS.map((entry) => entry.id)] as const}
          current={group ?? "all"}
          text={(choice) => JOURNAL_GROUPS.find((entry) => entry.id === choice)?.label ?? "Tout"}
          href={(choice) => queryHref(path, { ...kept, groupe: choice === "all" ? "" : choice, page: "" })}
        />
        <form action={path} className="flex min-w-0 flex-[1_1_22rem] flex-wrap items-center gap-x-5 gap-y-3">
          {group && <input type="hidden" name="groupe" value={group} />}
          <label className="flex min-w-0 flex-[1_1_13rem] items-center gap-2 border bg-background px-2.5 text-muted-foreground focus-within:border-ring rounded-lg">
            <MagnifierIcon />
            <span className="sr-only">Joueur ou alliance</span>
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Joueur ou alliance"
              className="h-9 w-full min-w-0 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
            />
          </label>
          <label className="flex items-center gap-2">
            <SmallLabel>Jour</SmallLabel>
            <Input type="date" name="jour" defaultValue={day ? dayText : ""} className="h-9 w-40" />
          </label>
          <button
            type="submit"
            className="h-9 bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/85 rounded-lg"
          >
            Filtrer
          </button>
        </form>
      </div>

      <div className={`grid gap-5 ${shown ? "lg:grid-cols-2" : ""}`}>
        <Panel
          title="Changements par jour"
          aside={
            <span className="text-xs text-muted-foreground">
              30 derniers jours{days.length >= MIN_CURVE_DAYS && " · cliquer un jour l'affiche"}
            </span>
          }
        >
          <JournalActivityChart
            points={days.map(({ day: date, ...groups }) => ({
              day: dayMonth(date),
              href: dayHref(dayValue(date)),
              ...groups,
            }))}
          />
        </Panel>
        {shown && (
          <StatGrid label={`Changements du ${dayMonth(shown.day)}`}>
            <Stat
              label={`Le ${dayMonth(shown.day)}`}
              value={formatNumber(total(shown))}
              hint={total(shown) === 1 ? "changement" : "changements"}
            />
            {JOURNAL_GROUPS.map((entry) => (
              <Stat key={entry.id} label={entry.label} value={formatNumber(shown[entry.id])} hint={HINTS[entry.id]} />
            ))}
          </StatGrid>
        )}
      </div>

      <Panel
        flush
        title={day ? longDay(day.gte) : "Derniers changements"}
        aside={<span className="text-xs text-muted-foreground">les noms mènent aux fiches</span>}
      >
        {readings.length > 0 ? (
          readings.map((entry, index) => {
            // A reading cut by the page's edge: its count would be wrong, the time alone is shown.
            const whole = !(index === 0 && page > 1) && !(index === readings.length - 1 && page < pages);
            const time = day ? clock(entry.at) : formatDateTime(entry.at);
            return (
              <section key={entry.at.getTime()} aria-label={`Relevé du ${formatDateTime(entry.at)}`}>
                <h3 className="border-b bg-raised px-4 py-1.5">
                  <SmallLabel>
                    {whole ? `${time} · ${plural(entry.lines.length, "changement", "changements")}` : time}
                  </SmallLabel>
                </h3>
                <JournalList server={server.id} lines={entry.lines} named timed={false} grouped={group === null} />
              </section>
            );
          })
        ) : (
          <p className="p-4 text-sm text-muted-foreground">
            {filtered ? "Aucun changement ne correspond." : "Aucun changement noté depuis le premier relevé du site."}
          </p>
        )}
        {(count > 0 || day) && (
          <nav aria-label="Pages" className="flex items-center justify-between gap-4 border-t px-4 py-2.5 text-sm">
            {page > 1 ? (
              <Link href={pageHref(page - 1)} className={buttonVariants({ variant: "outline", size: "lg" })}>
                ← {formatNumber(PAGE_SIZE)} précédents
              </Link>
            ) : previousDay ? (
              <Link href={dayHref(previousDay)} className={buttonVariants({ variant: "outline", size: "lg" })}>
                ← {dayMonth(parisDayRange(previousDay)?.gte ?? new Date())}
              </Link>
            ) : (
              <span />
            )}
            <span className="text-xs text-muted-foreground">
              {count > 0
                ? `${formatNumber(first)}–${formatNumber(first + lines.length - 1)} sur ${formatNumber(count)}`
                : "Aucun changement"}
            </span>
            {page < pages ? (
              <Link href={pageHref(page + 1)} className={buttonVariants({ variant: "outline", size: "lg" })}>
                {formatNumber(Math.min(PAGE_SIZE, count - page * PAGE_SIZE))} suivants
              </Link>
            ) : nextDay ? (
              <Link href={dayHref(nextDay)} className={buttonVariants({ variant: "outline", size: "lg" })}>
                {dayMonth(parisDayRange(nextDay)?.gte ?? new Date())} →
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </Panel>

      {/* Never beside « Aucun changement »: an ad needs the page to say something (site-publicite.md). */}
      {lines.length > 0 && <AdSlot />}
    </div>
  );
}
