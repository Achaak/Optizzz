"use client";

// The « Convois » tab of a space (docs/features/site-envois.md, « Vues » and « Statistiques des convois »): the
// members' convoys both ways, opened in this browser, as statistics over 7, 30 or 90 days, as the Équilibre (who
// should convoy, who should receive) or as a list, for the alliance or one member. The choice is kept in the address. A state is written in words (« En route », « Livré »),
// never told by a colour alone (ADR 0003).
import { formatNumber } from "@optizzz/game/format/number-format";
import { formatDateTime, formatEndTime } from "@optizzz/game/format/time-format";
import type { MemberStates } from "@optizzz/game/sharing/shared-state";
import type { DemandeConvoy } from "@optizzz/game/site-links/demandes";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CopyIcon } from "~/components/icons";
import { Segmented } from "~/components/tools/hunt/hunt-parts";
import { Button } from "~/components/ui/button";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { balanceDiscord } from "~/lib/envois/balance";
import { convoyStats, convoyStatsDiscord, PERIODS } from "~/lib/envois/convoy-stats";
import { convoyViewSearch, readConvoyView, type ConvoyView } from "~/lib/envois/convoy-view";
import { filterConvoys, type AllianceConvoy, type ConvoyFilter } from "~/lib/envois/convoys";
import { BalanceView } from "./balance-view";
import { ConvoyStatsView } from "./convoy-stats-view";
import { Callout, FIELD_LABEL, Panel } from "./parts";
import { useServerAlliances } from "./use-server-alliances";
import { useSpaceBalance } from "./use-space-balance";

const STATES = [
  { value: "all", label: "Tous" },
  { value: "transit", label: "En route" },
  { value: "delivered", label: "Livrés" },
] as const;

const VIEWS = [
  { value: "stats", label: "Statistiques" },
  { value: "balance", label: "Équilibre" },
  { value: "list", label: "Liste" },
] as const;

const PERIOD_OPTIONS = PERIODS.map((days) => ({ value: days, label: `${String(days)} jours` }));

const when = (convoy: AllianceConvoy, now: Date) =>
  convoy.kind === "transit"
    ? `arrivée ${formatEndTime(new Date(convoy.at), now)}`
    : `le ${formatDateTime(new Date(convoy.at))}`;

/** « Liste »: each convoy, on its way first, then delivered. */
function ConvoyList({ convoys, member, now }: { convoys: AllianceConvoy[]; member: string | null; now: Date }) {
  const [state, setState] = useState<ConvoyFilter["state"]>("all");
  const filter: ConvoyFilter = { state, member };

  const shown = filterConvoys(convoys, filter, now);
  const total = shown.reduce((sum, c) => ({ food: sum.food + c.food, materials: sum.materials + c.materials }), {
    food: 0,
    materials: 0,
  });

  return (
    <Panel title="Convois">
      <Segmented label="Convois à montrer" options={STATES} value={state} onChange={setState} />

      {shown.length === 0 ? (
        <p className="text-muted-foreground">
          {convoys.length === 0
            ? "Aucun convoi pour l'instant : un membre les envoie en cochant « Convois » dans l'extension (Fonctionnalités › Compte Optizzz)."
            : "Aucun convoi ne correspond."}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>État</TableHead>
                <TableHead>De</TableHead>
                <TableHead>À</TableHead>
                <TableHead className="text-right">Nourriture</TableHead>
                <TableHead className="text-right">Matériaux</TableHead>
                <TableHead>Quand</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((c) => (
                <TableRow key={c.fingerprint}>
                  <TableCell className={c.kind === "transit" ? "font-medium" : undefined}>
                    {c.kind === "transit" ? "En route" : "Livré"}
                  </TableCell>
                  <TableCell>{c.from}</TableCell>
                  <TableCell>{c.to}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(c.food)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(c.materials)}</TableCell>
                  <TableCell title={`Relevé par ${c.reporter}`}>{when(c, now)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            {shown.length > 1 && (
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={3}>Total</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(total.food)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(total.materials)}</TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Seuls les convois des membres qui les envoient à Optizzz apparaissent ici, gardés 90 jours. Un convoi vu par
        celui qui l&apos;envoie et par celui qui le reçoit ne compte qu&apos;une fois. Un convoi arrivé revient en
        «&nbsp;Livré&nbsp;» quand l&apos;un des deux a ouvert sa messagerie.
      </p>
    </Panel>
  );
}

export function ConvoysPanel({
  convoys,
  refused,
  members,
  sends,
  demandeConvoys,
  states,
  server,
  tag,
  loading,
}: {
  /** Null while the access to the space is not open on this device. */
  convoys: AllianceConvoy[] | null;
  refused: number;
  members: readonly { playerId: number; pseudo: string }[];
  /** What each member sends, as their extension said. */
  sends: readonly { playerId: number; categories: string[] }[];
  /** The convoys attached to a Demande; null until opened. */
  demandeConvoys: readonly DemandeConvoy[] | null;
  /** The members' states, for the Entrepôt estimé and the tax rates; null until opened. */
  states: readonly MemberStates[] | null;
  server: string;
  tag: string;
  loading: boolean;
}) {
  const pseudos = useMemo(() => members.map((m) => m.pseudo), [members]);
  const params = useSearchParams();
  const [choice, setChoice] = useState<ConvoyView>(() => readConvoyView(params, pseudos));
  const [copied, setCopied] = useState<"done" | "failed" | null>(null);
  const now = new Date();

  useEffect(() => {
    window.history.replaceState(null, "", `${window.location.pathname}?${convoyViewSearch(choice)}`);
  }, [choice]);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(null), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const senders = members
    .filter((m) => sends.find((s) => s.playerId === m.playerId)?.categories.includes("convoys"))
    .map((m) => m.pseudo);
  const stats =
    convoys === null
      ? null
      : convoyStats({
          convoys,
          demandeConvoys: demandeConvoys ?? [],
          members: pseudos,
          senders,
          days: choice.days,
          member: choice.member,
          now,
        });
  const outsiders =
    choice.view === "stats" &&
    stats !== null &&
    (stats.outside.sent.total > 0 || stats.outside.received.total > 0 || stats.rows.some((row) => !row.member));
  const alliances = useServerAlliances(server, outsiders);
  const balance = useSpaceBalance({
    server,
    tag,
    members,
    sends,
    convoys,
    states,
    days: choice.days,
    enabled: choice.view === "balance",
  });

  if (convoys === null || stats === null)
    return (
      <Panel title="Convois">
        <p className="text-muted-foreground">
          {loading
            ? "Lecture des convois…"
            : "Ouvrez l'accès à l'espace sur cet appareil (onglet « Espace ») pour lire les convois de l'alliance."}
        </p>
      </Panel>
    );

  const change = (next: Partial<ConvoyView>) => setChoice((current) => ({ ...current, ...next }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <div className="space-y-1">
          <span className={FIELD_LABEL}>Vue</span>
          <Segmented label="Vue" options={VIEWS} value={choice.view} onChange={(view) => change({ view })} />
        </div>
        {choice.view !== "list" && (
          <div className="space-y-1">
            <span className={FIELD_LABEL}>Période</span>
            <Segmented
              label="Période"
              options={PERIOD_OPTIONS}
              value={choice.days}
              onChange={(days) => change({ days })}
            />
          </div>
        )}
        <label className="space-y-1">
          <span className={FIELD_LABEL}>Membre</span>
          <select
            value={choice.member ?? ""}
            onChange={(event) => change({ member: event.target.value || null })}
            className="block h-9 min-w-44 border bg-background px-2 text-sm rounded-lg"
          >
            <option value="">Toute l&apos;alliance</option>
            {pseudos.map((pseudo) => (
              <option key={pseudo} value={pseudo}>
                {pseudo}
              </option>
            ))}
          </select>
        </label>
        {(choice.view === "stats" || (choice.view === "balance" && balance.balance !== null)) && (
          <div className="ml-auto flex items-center gap-3">
            <span role="status" className="text-xs text-muted-foreground">
              {copied === "done" && "Copié : collez-le dans Discord."}
              {copied === "failed" && "La copie a échoué."}
            </span>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const context = { tag, days: choice.days, now: new Date() };
                const text =
                  choice.view === "balance" && balance.balance
                    ? balanceDiscord(balance.balance, context)
                    : convoyStatsDiscord(stats, context);
                navigator.clipboard.writeText(text).then(
                  () => setCopied("done"),
                  () => setCopied("failed"),
                );
              }}
            >
              <CopyIcon />
              Copier pour Discord
            </Button>
          </div>
        )}
      </div>

      {refused > 0 && (
        <Callout tone="warning">
          {refused === 1 ? "Un Envoi ne s'ouvre pas" : `${formatNumber(refused)} Envois ne s'ouvrent pas`} : modifié
          hors de l&apos;extension d&apos;un membre, ou chiffré avec une version de l&apos;accès que vous n&apos;avez
          pas. Il n&apos;est pas compté.
        </Callout>
      )}
      {choice.view === "stats" ? (
        <ConvoyStatsView stats={stats} days={choice.days} member={choice.member} alliances={alliances} now={now} />
      ) : choice.view === "balance" ? (
        balance.balance ? (
          <BalanceView key={choice.member ?? ""} balance={balance.balance} days={choice.days} member={choice.member} />
        ) : (
          <Panel title="Équilibre">
            <p className="text-muted-foreground">
              {balance.loading ? "Lecture des TDC de l'alliance…" : "Les TDC de l'alliance ne se lisent pas."}
            </p>
          </Panel>
        )
      ) : (
        <ConvoyList convoys={convoys} member={choice.member} now={now} />
      )}
    </div>
  );
}
