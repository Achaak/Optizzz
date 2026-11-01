"use client";

// The « Floods » tab of a space (docs/features/site-envois.md, « Vues » and « Statistiques des floods »): statistics over
// 24 hours or 7 days, or the list of the members' attacks on their way, by target, with who sends them, the take the
// Plan de flood expects and the arrival, Paris time (the ones arrived in the last 7 days on demand); for the alliance or
// one member, the choice kept in the address. The army sent appears to the Admins only: the site hands it to nobody else.
import { formatNumber } from "@optizzz/game/format/number-format";
import { formatEndTime, formatPastTime } from "@optizzz/game/format/time-format";
import { floodArmyText } from "@optizzz/game/site-links/envoi-floods";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CopyIcon } from "~/components/icons";
import { Segmented } from "~/components/tools/hunt/hunt-parts";
import { Button } from "~/components/ui/button";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { floodStats, floodStatsDiscord } from "~/lib/envois/flood-stats";
import { floodViewSearch, readFloodView, type FloodView } from "~/lib/envois/flood-view";
import { floodsByTarget, type AllianceFlood } from "~/lib/envois/floods";
import { FloodStatsView } from "./flood-stats-view";
import { Callout, FIELD_LABEL, Panel } from "./parts";
import { useServerAlliances } from "./use-server-alliances";

const STATES = [
  { value: "transit", label: "En route" },
  { value: "arrived", label: "Arrivés" },
] as const;

const VIEWS = [
  { value: "stats", label: "Statistiques" },
  { value: "list", label: "Liste" },
] as const;

const PERIODS = [
  { value: "24h", label: "24 heures" },
  { value: "7j", label: "7 jours" },
] as const;

const NO_PLAN = "Lancée sans le Plan de flood : prise inconnue.";

/** « Liste »: the floods by target, on their way or arrived, of the alliance or of one member. */
function FloodList({
  floods,
  member,
  isAdmin,
  now,
}: {
  floods: AllianceFlood[];
  member: string | null;
  isAdmin: boolean;
  now: Date;
}) {
  const [state, setState] = useState<(typeof STATES)[number]["value"]>("transit");
  const shownFloods = member === null ? floods : floods.filter((f) => f.from.toLowerCase() === member.toLowerCase());
  const groups = floodsByTarget(shownFloods, state, now);
  const when = (flood: AllianceFlood) =>
    state === "transit" ? formatEndTime(new Date(flood.at), now) : formatPastTime(new Date(flood.at), now);

  return (
    <Panel title="Floods">
      <Segmented label="Floods à montrer" options={STATES} value={state} onChange={setState} />

      {groups.length === 0 ? (
        <p className="text-muted-foreground">
          {shownFloods.length === 0
            ? "Aucun flood pour l'instant : un membre envoie ses attaques en route en cochant « Floods » dans l'extension (Fonctionnalités › Compte Optizzz)."
            : state === "transit"
              ? "Aucun flood en route."
              : "Aucun flood arrivé ces 7 derniers jours."}
        </p>
      ) : (
        groups.map((group) => {
          const takes = group.floods.flatMap((f) => (f.take === null ? [] : [f.take]));
          return (
            <section key={group.target} className="space-y-2" aria-label={`Floods sur ${group.target}`}>
              <h3 className="font-medium break-words">
                {group.target}{" "}
                <span className="font-normal text-muted-foreground">
                  · {group.floods.length === 1 ? "1 flood" : `${String(group.floods.length)} floods`}
                </span>
              </h3>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>De</TableHead>
                      <TableHead className="text-right">Prise attendue</TableHead>
                      <TableHead>Arrivée</TableHead>
                      {isAdmin && <TableHead>Armée envoyée</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.floods.map((f) => (
                      <TableRow key={f.fingerprint}>
                        <TableCell>{f.from}</TableCell>
                        <TableCell className="text-right tabular-nums" title={f.take === null ? NO_PLAN : undefined}>
                          {f.take === null ? "—" : formatNumber(f.take)}
                        </TableCell>
                        <TableCell>{when(f)}</TableCell>
                        {isAdmin && (
                          <TableCell className="tabular-nums">
                            {f.army ? floodArmyText(f.army) : <span className="text-muted-foreground">—</span>}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                  {group.floods.length > 1 && takes.length > 0 && (
                    <TableFooter>
                      <TableRow>
                        <TableCell>Total</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatNumber(takes.reduce((sum, take) => sum + take, 0))}
                          {takes.length < group.floods.length && " et plus"}
                        </TableCell>
                        <TableCell colSpan={isAdmin ? 2 : 1} />
                      </TableRow>
                    </TableFooter>
                  )}
                </Table>
              </div>
            </section>
          );
        })
      )}
      <p className="text-xs text-muted-foreground">
        Seuls les floods des membres qui les envoient à Optizzz apparaissent ici, gardés 7 jours après leur arrivée. La
        prise attendue est celle du Plan de flood&nbsp;; «&nbsp;—&nbsp;» pour une attaque lancée sans lui.{" "}
        {isAdmin
          ? "L'armée envoyée n'est montrée qu'aux Admins : optizzz.fr ne la renvoie qu'à eux (c'est le site qui la réserve, pas le chiffrement)."
          : "L'armée envoyée n'est montrée qu'aux Admins de l'espace."}
      </p>
    </Panel>
  );
}

export function FloodsPanel({
  floods,
  refused,
  isAdmin,
  members,
  sends,
  server,
  tag,
  loading,
}: {
  /** Null while the access to the space is not open on this device. */
  floods: AllianceFlood[] | null;
  refused: number;
  isAdmin: boolean;
  members: readonly { playerId: number; pseudo: string }[];
  /** What each member sends, as their extension said. */
  sends: readonly { playerId: number; categories: string[] }[];
  server: string;
  tag: string;
  loading: boolean;
}) {
  const pseudos = useMemo(() => members.map((m) => m.pseudo), [members]);
  const params = useSearchParams();
  const [choice, setChoice] = useState<FloodView>(() => readFloodView(params, pseudos));
  const [copied, setCopied] = useState<"done" | "failed" | null>(null);
  const now = new Date();

  useEffect(() => {
    window.history.replaceState(null, "", `${window.location.pathname}?${floodViewSearch(choice)}`);
  }, [choice]);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(null), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const senders = members
    .filter((m) => sends.find((s) => s.playerId === m.playerId)?.categories.includes("floods"))
    .map((m) => m.pseudo);
  const stats =
    floods === null
      ? null
      : floodStats({ floods, members: pseudos, senders, period: choice.period, member: choice.member, now });
  const alliances = useServerAlliances(server, choice.view === "stats" && stats !== null && stats.targets.length > 0);

  if (floods === null || stats === null)
    return (
      <Panel title="Floods">
        <p className="text-muted-foreground">
          {loading
            ? "Lecture des floods…"
            : "Ouvrez l'accès à l'espace sur cet appareil (onglet « Espace ») pour lire les floods de l'alliance."}
        </p>
      </Panel>
    );

  const change = (next: Partial<FloodView>) => setChoice((current) => ({ ...current, ...next }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <div className="space-y-1">
          <span className={FIELD_LABEL}>Vue</span>
          <Segmented label="Vue" options={VIEWS} value={choice.view} onChange={(view) => change({ view })} />
        </div>
        {choice.view === "stats" && (
          <div className="space-y-1">
            <span className={FIELD_LABEL}>Période</span>
            <Segmented
              label="Période"
              options={PERIODS}
              value={choice.period}
              onChange={(period) => change({ period })}
            />
          </div>
        )}
        <label className="space-y-1">
          <span className={FIELD_LABEL}>Membre</span>
          <select
            value={choice.member ?? ""}
            onChange={(event) => change({ member: event.target.value || null })}
            className="block h-9 min-w-44 border bg-background px-2 text-sm"
          >
            <option value="">Toute l&apos;alliance</option>
            {pseudos.map((pseudo) => (
              <option key={pseudo} value={pseudo}>
                {pseudo}
              </option>
            ))}
          </select>
        </label>
        {choice.view === "stats" && (
          <div className="ml-auto flex items-center gap-3">
            <span role="status" className="text-xs text-muted-foreground">
              {copied === "done" && "Copié : collez-le dans Discord."}
              {copied === "failed" && "La copie a échoué."}
            </span>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const text = floodStatsDiscord(stats, { tag, period: choice.period, now: new Date(), alliances });
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
        <FloodStatsView
          stats={stats}
          period={choice.period}
          member={choice.member}
          isAdmin={isAdmin}
          alliances={alliances}
          now={now}
        />
      ) : (
        <FloodList floods={floods} member={choice.member} isAdmin={isAdmin} now={now} />
      )}
    </div>
  );
}
