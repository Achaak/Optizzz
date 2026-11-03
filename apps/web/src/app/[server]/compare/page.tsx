import { cn } from "cn";
import { formatCompact, formatNumber } from "@optizzz/game/format/number-format";
import { dayMonth } from "@optizzz/game/format/time-format";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdSlot } from "~/components/ad-slot";
import { CompareAdd } from "~/components/compare-add";
import { CompareChart, CompareKey } from "~/components/compare-chart";
import { CloseIcon } from "~/components/icons";
import { ChoiceLinks } from "~/components/list-parts";
import { SmallLabel, PageHeader, Panel } from "~/components/panel";
import { CopyLinkButton } from "~/components/tools/copy-link-button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import {
  byLast,
  COMPARE_KINDS,
  COMPARE_METRICS,
  COMPARE_PERIODS,
  compareHref,
  deltaText,
  idsOf,
  MAX_COMPARED,
  mergeSeries,
  METRIC_LABELS,
  PERIOD_LABELS,
  periodStart,
  SHOWN_PERIODS,
  type CompareKind,
  type CompareState,
} from "~/lib/compare";
import { choiceOf, serverOfPath, textOf } from "~/lib/game-server";
import { ordinal } from "~/lib/server-stats";
import { compared, findAlliance, findPlayerByPseudo, lastDay } from "~/server/queries";

interface Props {
  params: Promise<{ server: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const server = serverOfPath((await params).server, "/compare");
  // Players' curves, like their own pages: out of the search engines.
  return { title: `Comparer sur ${server.name}`, robots: { index: false } };
}

export default async function ComparePage({ params, searchParams }: Props) {
  const server = serverOfPath((await params).server, "/compare");
  const query = await searchParams;
  const kind = choiceOf(query.type, COMPARE_KINDS);
  const state: CompareState = {
    kind,
    ids: idsOf(kind, query.ids),
    metric: choiceOf(query.courbe, COMPARE_METRICS),
    period: choiceOf(query.periode, COMPARE_PERIODS),
  };
  const href = (change: Partial<CompareState>) => compareHref(server.id, { ...state, ...change });

  // A name typed in the field: its player or alliance joins the others, the address keeps it.
  const added = textOf(query.ajout);
  let missing: string | null = null;
  if (added) {
    const found =
      kind === "players"
        ? await findPlayerByPseudo(server.id, added).then((player) => player && String(player.id))
        : await findAlliance(server.id, added).then((alliance) => alliance?.tag ?? null);
    if (found && state.ids.length < MAX_COMPARED) redirect(href({ ids: [...state.ids, found] }));
    if (!found) missing = added;
  }

  const last = await lastDay(server.id);
  const entries = await compared(
    server.id,
    kind,
    state.ids,
    state.metric,
    last ? periodStart(state.period, last) : null,
  );
  const rank = state.metric === "rank";
  const rows = mergeSeries(entries).map((row) => ({ day: dayMonth(row.day), values: row.values }));
  const show = (value: number) => (rank ? ordinal(value) : formatNumber(value));
  const brief = (value: number) => (rank ? ordinal(value) : formatCompact(value));
  // The table puts the best first; each keeps its mark from the chart.
  const ranked = byLast(
    entries.map((entry, index) => ({ ...entry, index })),
    rank,
  );
  const noun = kind === "players" ? "joueur" : "alliance";
  const entryHref = (id: string) =>
    kind === "players" ? `/${server.id}/players/${id}` : `/${server.id}/alliances/${encodeURIComponent(id)}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Comparer"
        actions={
          <>
            <KindSwitch
              current={kind}
              href={(choice) =>
                choice === kind ? href({}) : compareHref(server.id, { ...state, kind: choice, ids: [] })
              }
            />
            {entries.length > 0 && <CopyLinkButton />}
          </>
        }
      >
        De 2 à {MAX_COMPARED} joueurs ou alliances de {server.name} sur une même courbe. Le lien garde votre sélection.
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2">
        {entries.map((entry, index) => (
          <span
            key={entry.id}
            className="inline-flex h-9 items-center gap-2 rounded-full bg-card pr-1 pl-3 text-sm shadow-panel"
          >
            <CompareKey index={index} />
            <Link href={entryHref(entry.id)} className="font-semibold hover:underline">
              {entry.name}
            </Link>
            {entry.alliance && <span className="text-xs text-muted-foreground">{entry.alliance}</span>}
            <Link
              href={href({ ids: state.ids.filter((id) => id !== entry.id) })}
              aria-label={`Retirer ${entry.name}`}
              className="grid size-7 place-items-center text-muted-foreground hover:text-foreground"
            >
              <CloseIcon width={12} height={12} />
            </Link>
          </span>
        ))}
        {state.ids.length < MAX_COMPARED ? (
          <CompareAdd server={server.id} state={state} />
        ) : (
          <SmallLabel>{MAX_COMPARED} au plus</SmallLabel>
        )}
      </div>
      {missing && (
        <p role="status" className="border border-warning-border bg-warning-soft px-3 py-2 text-sm rounded-[0.625rem]">
          Aucun{kind === "players" ? "" : "e"} {noun} « {missing} » sur {server.name}
          {kind === "players" ? " : choisissez-le dans la liste qui s'ouvre en tapant." : " : tapez son tag."}
        </p>
      )}

      {entries.length > 0 ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <ChoiceLinks
              label="Courbe"
              choices={COMPARE_METRICS}
              current={state.metric}
              text={(choice) => METRIC_LABELS[choice]}
              href={(choice) => href({ metric: choice })}
            />
            <ChoiceLinks
              label="Période"
              choices={SHOWN_PERIODS}
              current={state.period}
              text={(choice) => PERIOD_LABELS[choice]}
              href={(choice) => href({ period: choice })}
            />
          </div>

          <Panel
            title={`${METRIC_LABELS[state.metric]}${rows.length > 0 ? ` · ${rows[0]?.day ?? ""} → ${rows.at(-1)?.day ?? ""}` : ""}`}
            aside={
              <span className="text-xs text-muted-foreground">
                {rank ? "rang au TDC, 1 en haut" : `chaque ${noun} a sa marque et son trait`}
              </span>
            }
          >
            {rows.length > 1 ? (
              <CompareChart names={entries.map((entry) => entry.name)} rows={rows} reversed={rank} />
            ) : (
              <p className="text-sm text-muted-foreground">Pas encore assez de relevés pour une courbe.</p>
            )}
            <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 font-mono text-xs" aria-label="Légende">
              {entries.map((entry, index) => {
                const final = entry.points.at(-1)?.value;
                return (
                  <li key={entry.id} className="flex items-center gap-2">
                    <CompareKey index={index} />
                    {entry.name}
                    {final !== undefined && ` · ${brief(final)}`}
                  </li>
                );
              })}
            </ul>
          </Panel>

          <Panel flush title={rows.length > 0 ? `Au ${rows.at(-1)?.day ?? ""}` : "Chiffres"}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">{kind === "players" ? "Joueur" : "Alliance"}</TableHead>
                  {kind === "players" && <TableHead className="hidden sm:table-cell">Alliance</TableHead>}
                  <TableHead className="hidden text-right sm:table-cell">Le {rows[0]?.day ?? "—"}</TableHead>
                  <TableHead className="text-right">Le {rows.at(-1)?.day ?? "—"}</TableHead>
                  <TableHead className="pr-4 text-right md:pr-2">Écart</TableHead>
                  <TableHead className="hidden pr-4 text-right md:table-cell">Rang</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ranked.map((entry) => {
                  const first = entry.points[0]?.value;
                  const final = entry.points.at(-1)?.value;
                  return (
                    <TableRow key={entry.id}>
                      <TableCell className="pl-4">
                        <span className="flex items-center gap-2">
                          <CompareKey index={entry.index} />
                          <Link href={entryHref(entry.id)} className="font-semibold hover:underline">
                            {entry.name}
                          </Link>
                        </span>
                      </TableCell>
                      {kind === "players" && (
                        <TableCell className="hidden sm:table-cell">{entry.alliance ?? "—"}</TableCell>
                      )}
                      <TableCell className="hidden text-right sm:table-cell">
                        {first === undefined ? "—" : show(first)}
                      </TableCell>
                      <TableCell className="text-right">{final === undefined ? "—" : show(final)}</TableCell>
                      <TableCell className="pr-4 text-right md:pr-2">
                        {first === undefined || final === undefined ? "—" : deltaText(first, final, rank)}
                      </TableCell>
                      <TableCell className="hidden pr-4 text-right md:table-cell">{ordinal(entry.rankNow)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Panel>
          {entries.length === 1 && (
            <p role="note" className="bg-info-soft px-3.5 py-2.5 text-sm rounded-[0.625rem]">
              {kind === "players"
                ? "Un seul joueur choisi : ajoutez-en un deuxième avec le champ ci-dessus pour les comparer."
                : "Une seule alliance choisie : ajoutez-en une deuxième avec le champ ci-dessus pour les comparer."}
            </p>
          )}
        </>
      ) : (
        <p role="note" className="bg-info-soft px-3.5 py-2.5 text-sm rounded-[0.625rem]">
          Ajoutez un{kind === "players" ? "" : "e"} {noun} avec le champ ci-dessus, ou depuis sa fiche avec « Comparer
          ».
        </p>
      )}

      <AdSlot />
    </div>
  );
}

/** Players or alliances, in the page's header: the same look as the other choices, without their label. */
function KindSwitch({ current, href }: { current: CompareKind; href: (choice: CompareKind) => string }) {
  return (
    <nav aria-label="Comparer des" className="flex flex-wrap gap-0.5 rounded-full bg-raised p-[3px]">
      {COMPARE_KINDS.map((choice) => (
        <Link
          key={choice}
          href={href(choice)}
          aria-current={choice === current ? "true" : undefined}
          className={cn(
            "rounded-full px-3 py-1.5 text-sm",
            choice === current
              ? "bg-primary font-semibold text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {choice === "players" ? "Joueurs" : "Alliances"}
        </Link>
      ))}
    </nav>
  );
}
