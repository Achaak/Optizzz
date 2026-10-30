import { formatNumber } from "@optizzz/game/format/number-format";
import { dayMonth } from "@optizzz/game/format/time-format";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdSlot } from "~/components/ad-slot";
import { CompareAdd } from "~/components/compare-add";
import { CompareChart, CompareKey } from "~/components/compare-chart";
import { CloseIcon } from "~/components/icons";
import { ChoiceLinks } from "~/components/list-parts";
import { MonoLabel, PageHeader, Panel } from "~/components/panel";
import { CopyLinkButton } from "~/components/tools/copy-link-button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import {
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
  const noun = kind === "players" ? "joueur" : "alliance";
  const entryHref = (id: string) =>
    kind === "players" ? `/${server.id}/players/${id}` : `/${server.id}/alliances/${encodeURIComponent(id)}`;

  return (
    <div className="space-y-6">
      <PageHeader title="Comparer" kicker={`Serveur ${server.name}`} actions={entries.length > 0 && <CopyLinkButton />}>
        De 2 à {MAX_COMPARED} {kind === "players" ? "joueurs" : "alliances"} sur une même courbe, relevé de minuit.
        L&apos;adresse garde votre choix : copiez-la pour la partager.
      </PageHeader>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <ChoiceLinks
          label="Comparer des"
          choices={COMPARE_KINDS}
          current={kind}
          text={(choice) => (choice === "players" ? "Joueurs" : "Alliances")}
          href={(choice) => (choice === kind ? href({}) : compareHref(server.id, { ...state, kind: choice, ids: [] }))}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {entries.map((entry, index) => (
          <span key={entry.id} className="inline-flex h-9 items-center gap-2 border bg-card pr-1 pl-2.5 text-sm">
            <CompareKey index={index} />
            <Link href={entryHref(entry.id)} className="font-semibold hover:underline">
              {entry.name}
            </Link>
            {entry.alliance && <span className="font-mono text-xs text-muted-foreground">{entry.alliance}</span>}
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
          <MonoLabel>{MAX_COMPARED} au plus</MonoLabel>
        )}
      </div>
      {missing && (
        <p role="status" className="border border-warning-border bg-warning-soft px-3 py-2 text-sm">
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
              choices={COMPARE_PERIODS}
              current={state.period}
              text={(choice) => PERIOD_LABELS[choice]}
              href={(choice) => href({ period: choice })}
            />
          </div>

          <Panel
            title={`${METRIC_LABELS[state.metric]}${rows.length > 0 ? ` · ${rows[0]?.day ?? ""} → ${rows.at(-1)?.day ?? ""}` : ""}`}
            aside={
              <span className="text-xs text-muted-foreground">
                {rank ? "rang au TDC, 1 en haut" : "chacun a sa marque et son trait"}
              </span>
            }
          >
            {rows.length > 1 ? (
              <CompareChart names={entries.map((entry) => entry.name)} rows={rows} reversed={rank} />
            ) : (
              <p className="text-sm text-muted-foreground">Pas encore assez de relevés pour une courbe.</p>
            )}
            <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm" aria-label="Légende">
              {entries.map((entry, index) => (
                <li key={entry.id} className="flex items-center gap-2">
                  <CompareKey index={index} />
                  {entry.name}
                </li>
              ))}
            </ul>
          </Panel>

          <Panel flush title="Chiffres">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">{kind === "players" ? "Joueur" : "Alliance"}</TableHead>
                  {kind === "players" && <TableHead className="hidden sm:table-cell">Alliance</TableHead>}
                  <TableHead className="text-right">Le {rows[0]?.day ?? "—"}</TableHead>
                  <TableHead className="text-right">Le {rows.at(-1)?.day ?? "—"}</TableHead>
                  <TableHead className="text-right">Écart</TableHead>
                  <TableHead className="hidden pr-4 text-right md:table-cell">Maintenant</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry, index) => {
                  const first = entry.points[0]?.value;
                  const final = entry.points.at(-1)?.value;
                  return (
                    <TableRow key={entry.id}>
                      <TableCell className="pl-4">
                        <span className="flex items-center gap-2">
                          <CompareKey index={index} />
                          <Link href={entryHref(entry.id)} className="font-semibold hover:underline">
                            {entry.name}
                          </Link>
                        </span>
                      </TableCell>
                      {kind === "players" && (
                        <TableCell className="hidden sm:table-cell">{entry.alliance ?? "—"}</TableCell>
                      )}
                      <TableCell className="text-right font-mono">{first === undefined ? "—" : show(first)}</TableCell>
                      <TableCell className="text-right font-mono">{final === undefined ? "—" : show(final)}</TableCell>
                      <TableCell className="text-right font-mono">
                        {first === undefined || final === undefined ? "—" : deltaText(first, final, rank)}
                      </TableCell>
                      <TableCell className="hidden pr-4 text-right font-mono md:table-cell">
                        {show(entry.now)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Panel>
          {entries.length === 1 && (
            <p className="text-sm text-muted-foreground">
              Ajoutez un{kind === "players" ? "" : "e"} deuxième {noun} pour les comparer.
            </p>
          )}
        </>
      ) : (
        <Panel>
          <p className="text-sm text-muted-foreground">
            Ajoutez un{kind === "players" ? "" : "e"} {noun} avec le champ ci-dessus, ou depuis sa fiche avec « Comparer
            ».
          </p>
        </Panel>
      )}

      <AdSlot />
    </div>
  );
}
