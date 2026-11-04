"use client";

// The « Chasses » tab of a space (docs/features/site-envois.md, « Chasses par membre »): statistics over 24 hours, 7 or
// 30 days, or the list of the members' hunts, out or back; for the alliance or one member, the choice kept in the
// address.
import { formatNumber } from "@optizzz/game/format/number-format";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CopyIcon } from "~/components/icons";
import { Segmented } from "~/components/tools/hunt/hunt-parts";
import { Button } from "~/components/ui/button";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { huntStats, huntStatsDiscord } from "~/lib/envois/hunt-stats";
import { huntViewSearch, readHuntView, type HuntView } from "~/lib/envois/hunt-view";
import type { AllianceHunt } from "~/lib/envois/hunts";
import { HuntRows, HuntStatsView } from "./hunt-stats-view";
import { Callout, FIELD_LABEL, Panel } from "./parts";

const STATES = [
  { value: "out", label: "En cours" },
  { value: "back", label: "Rentrées" },
] as const;

const VIEWS = [
  { value: "stats", label: "Statistiques" },
  { value: "list", label: "Liste" },
] as const;

const PERIODS = [
  { value: "24h", label: "24 heures" },
  { value: "7j", label: "7 jours" },
  { value: "30j", label: "30 jours" },
] as const;

/** The list shows this many hunts back at most: the site keeps 90 days of them. */
const BACK_SHOWN = 200;

/** « Liste »: the hunts out (soonest back first) or back (latest first), of the alliance or of one member. */
function HuntList({ hunts, member, now }: { hunts: AllianceHunt[]; member: string | null; now: Date }) {
  const [state, setState] = useState<(typeof STATES)[number]["value"]>("out");
  const theirs = member === null ? hunts : hunts.filter((h) => h.hunter.toLowerCase() === member.toLowerCase());
  const shown =
    state === "out"
      ? theirs.filter((h) => h.returnsAt > now.getTime()).sort((a, b) => a.returnsAt - b.returnsAt)
      : theirs.filter((h) => h.returnsAt <= now.getTime()).sort((a, b) => b.returnsAt - a.returnsAt);

  return (
    <Panel title="Chasses">
      <Segmented label="Chasses à montrer" options={STATES} value={state} onChange={setState} />
      {shown.length === 0 ? (
        <p className="text-muted-foreground">
          {theirs.length === 0
            ? "Aucune chasse pour l'instant : un membre envoie ses chasses en cochant « Chasses » dans l'extension (Fonctionnalités › Compte Optizzz)."
            : state === "out"
              ? "Aucune chasse en cours."
              : "Aucune chasse rentrée."}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Membre</TableHead>
                <TableHead>Retour</TableHead>
                <TableHead className="text-right">Terrain (cm²)</TableHead>
                <TableHead className="pr-4 text-right">Fourmis</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <HuntRows hunts={shown.slice(0, BACK_SHOWN)} now={now} hunter />
            </TableBody>
          </Table>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Seules les chasses des membres qui les envoient à Optizzz apparaissent ici, gardées 90 jours après leur retour
        {shown.length > BACK_SHOWN && ` (les ${formatNumber(BACK_SHOWN)} plus récentes montrées)`}. «&nbsp;—&nbsp;» pour
        les fourmis : chasse lancée sans le Compte+.
      </p>
    </Panel>
  );
}

export function HuntsPanel({
  hunts,
  refused,
  members,
  sends,
  tag,
  loading,
}: {
  /** Null while the access to the space is not open on this device. */
  hunts: AllianceHunt[] | null;
  refused: number;
  members: readonly { playerId: number; pseudo: string }[];
  /** What each member sends, as their extension said. */
  sends: readonly { playerId: number; categories: string[] }[];
  tag: string;
  loading: boolean;
}) {
  const pseudos = useMemo(() => members.map((m) => m.pseudo), [members]);
  const params = useSearchParams();
  const [choice, setChoice] = useState<HuntView>(() => readHuntView(params, pseudos));
  const [copied, setCopied] = useState<"done" | "failed" | null>(null);
  const now = new Date();

  useEffect(() => {
    window.history.replaceState(null, "", `${window.location.pathname}?${huntViewSearch(choice)}`);
  }, [choice]);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(null), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const senders = members
    .filter((m) => sends.find((s) => s.playerId === m.playerId)?.categories.includes("hunts"))
    .map((m) => m.pseudo);

  if (hunts === null)
    return (
      <Panel title="Chasses">
        <p className="text-muted-foreground">
          {loading
            ? "Lecture des chasses…"
            : "Ouvrez l'accès à l'espace sur cet appareil (onglet « Espace ») pour lire les chasses de l'alliance."}
        </p>
      </Panel>
    );

  const stats = huntStats({ hunts, members: pseudos, senders, period: choice.period, member: choice.member, now });
  const change = (next: Partial<HuntView>) => setChoice((current) => ({ ...current, ...next }));

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
                const text = huntStatsDiscord(stats, { tag, period: choice.period, now: new Date() });
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
        <HuntStatsView stats={stats} period={choice.period} member={choice.member} now={now} />
      ) : (
        <HuntList hunts={hunts} member={choice.member} now={now} />
      )}
    </div>
  );
}
