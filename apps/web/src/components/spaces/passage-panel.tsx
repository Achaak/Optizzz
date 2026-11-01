"use client";

// « Plan de passage » of the « Chaîne » tab (docs/features/site-chaine.md, « Plan de passage »): who floods whom, by how
// much and when, for the field to climb from the hunters to the granaries without touching a flood already on its way.
// Computed in this browser when the view opens, then held still: new floods offer « Recalculer ». A state is written in
// words, never told by a colour alone (ADR 0003).
import { formatNumber } from "@optizzz/game/format/number-format";
import { formatEndTime, formatEndTimeShort, formatPastTime } from "@optizzz/game/format/time-format";
import { serverById } from "@optizzz/game/servers";
import type { MemberStates } from "@optizzz/game/sharing/shared-state";
import { bridge } from "@optizzz/game/tdc-chain/chain";
import { planPassage, type FloodOnWay, type Launch, type ProjectedFlood } from "@optizzz/game/tdc-chain/passage";
import { CHAIN_MARGIN, roleLabel, type Role } from "@optizzz/game/tdc-chain/roles";
import { cn } from "cn";
import { useEffect, useMemo, useState } from "react";
import { CopyIcon } from "~/components/icons";
import { Segmented } from "~/components/tools/hunt/hunt-parts";
import { Button } from "~/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import {
  HORIZONS,
  passageDiscord,
  passageInput,
  type PassageRosterMember,
  type PassageView,
} from "~/lib/spaces/passage";
import { Callout, FIELD_LABEL, Panel } from "./parts";

const HORIZON_OPTIONS = HORIZONS.map((hours) => ({ value: hours, label: `${String(hours)} h` }));

/** « 12 h 05 – 12 h 20 », one time when the window is closed, « ≈ » before a trip guessed without the Attack Speed. */
function departWindow(launch: Launch, now: Date): string {
  const from = formatEndTimeShort(new Date(launch.departFrom), now);
  const to = formatEndTimeShort(new Date(launch.departTo), now);
  return `${launch.approx ? "≈ " : ""}${from === to ? from : `${from} – ${to}`}`;
}

/** A flood on its way, as its target's queue shows it. */
function floodState(flood: ProjectedFlood): { text: string; tone: "ok" | "warn" } {
  if (flood.status === "fails") return { text: "⚠ échouera : hors portée à l'arrivée", tone: "warn" };
  if (flood.status === "reduced")
    return {
      text: `⚠ ${flood.before ?? "un autre flood"} passe devant : prise ${formatNumber(flood.actual)} au lieu de ${formatNumber(flood.expected)}`,
      tone: "warn",
    };
  return { text: "en route ✓", tone: "ok" };
}

function Pill({ tone, children }: { tone: "ok" | "warn" | "todo"; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-block px-1.5 font-mono text-[0.6875rem] whitespace-nowrap",
        tone === "ok" && "bg-chart-2/15 text-chart-2",
        tone === "todo" && "bg-primary/15 text-primary",
        tone === "warn" && "border border-warning-border bg-warning-soft text-foreground",
      )}
    >
      {children}
    </span>
  );
}

const keyOf = (floods: readonly FloodOnWay[]) =>
  floods
    .map((f) => `${f.from}>${f.target}@${String(f.at)}:${String(f.take)}`)
    .sort()
    .join("|");

export function PassagePanel({
  roster,
  exportAt,
  roles,
  keep,
  floods,
  states,
  choice,
  onChange,
  me,
  server,
  tag,
}: {
  roster: readonly PassageRosterMember[];
  exportAt: Date | null;
  roles: ReadonlyMap<number, Role>;
  keep: ReadonlyMap<number, number>;
  /** Null until the floods are opened. */
  floods: readonly FloodOnWay[] | null;
  states: readonly MemberStates[] | null;
  choice: PassageView;
  onChange: (next: Partial<PassageView>) => void;
  /** The reader's pseudo. */
  me: string;
  server: string;
  tag: string;
}) {
  // Held still from when it is computed: a plan that moves under the reader's eyes is no plan.
  const [openedAt] = useState(() => Date.now());
  const [snapshot, setSnapshot] = useState<{ at: number; floods: readonly FloodOnWay[] } | null>(null);
  const [copied, setCopied] = useState<"done" | "failed" | null>(null);
  // The first floods opened start the plan (React's « state from the previous render », not an effect).
  if (floods && !snapshot) setSnapshot({ at: openedAt, floods });
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(null), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const computed = useMemo(() => {
    if (!snapshot) return null;
    const { input, sources } = passageInput({
      roster,
      exportAt: exportAt?.getTime() ?? null,
      states,
      floods: snapshot.floods,
      roles,
      keep,
      now: snapshot.at,
      horizonHours: choice.horizon,
    });
    return { plan: planPassage(input), sources, now: new Date(Math.ceil(snapshot.at / 300_000) * 300_000) };
  }, [snapshot, roster, exportAt, states, roles, keep, choice.horizon]);

  if (!floods || !computed || !snapshot) return <p className="text-muted-foreground">Calcul du plan…</p>;

  const { plan, sources, now } = computed;
  const stale = keyOf(floods) !== keyOf(snapshot.floods);
  const names = new Map(roster.map((m) => [m.id, m.pseudo]));
  const name = (id: number) => names.get(id) ?? "?";
  const roleOf = (id: number) => roles.get(id) ?? ({ kind: "out" } as const);
  const chosen = roster.find((m) => m.pseudo.toLowerCase() === (choice.member ?? me).toLowerCase());
  const mine = chosen ? plan.launches.filter((l) => l.attackerId === chosen.id) : [];
  const later = now.getTime() + choice.horizon * 3600_000;
  const origin = serverById(server)?.origin;
  const alerts = plan.projection.floods.filter((f) => f.status !== "holds");
  const inChain = roster.filter((m) => roleOf(m.id).kind !== "out");
  const height = (role: Role) =>
    role.kind === "granary" ? 1e6 : role.kind === "passer" ? role.rank : role.kind === "hunter" ? 0 : -1;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <div className="space-y-1">
          <span className={FIELD_LABEL}>Horizon</span>
          <Segmented
            label="Horizon"
            options={HORIZON_OPTIONS}
            value={choice.horizon}
            onChange={(horizon) => onChange({ horizon })}
          />
        </div>
        <label className="space-y-1">
          <span className={FIELD_LABEL}>Les floods de</span>
          <select
            value={choice.member ?? ""}
            onChange={(event) => onChange({ member: event.target.value || null })}
            className="block h-9 min-w-44 border bg-background px-2 text-sm"
          >
            <option value="">Vous ({me})</option>
            {inChain
              .filter((m) => m.pseudo !== me)
              .map((m) => (
                <option key={m.id} value={m.pseudo}>
                  {m.pseudo}
                </option>
              ))}
          </select>
        </label>
        <div className="ml-auto flex items-center gap-3">
          <span role="status" className="text-xs text-muted-foreground">
            {copied === "done" && "Copié : collez-le dans Discord."}
            {copied === "failed" && "La copie a échoué."}
          </span>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              const text = passageDiscord(
                { launches: plan.launches, floods: plan.projection.floods },
                { tag, names, now },
              );
              navigator.clipboard.writeText(text).then(
                () => setCopied("done"),
                () => setCopied("failed"),
              );
            }}
          >
            <CopyIcon />
            Copier le plan pour Discord
          </Button>
        </div>
      </div>

      {stale && (
        <Callout tone="info">
          De nouveaux floods sont arrivés depuis le calcul.{" "}
          <button
            type="button"
            className="font-semibold text-primary hover:underline"
            onClick={() => setSnapshot({ at: Date.now(), floods })}
          >
            Recalculer
          </button>
        </Callout>
      )}

      <p className="text-muted-foreground">
        Calculé à {formatEndTimeShort(now, now)} d&apos;après le TDC envoyé avec «&nbsp;Production&nbsp;» ou, à défaut,
        l&apos;export (≈) ; les floods en route des membres qui envoient «&nbsp;Floods&nbsp;» ; les chasses qui
        rentrent.
      </p>

      <div className="flex flex-wrap items-start gap-5">
        <div className="flex min-w-0 flex-[999_1_40rem] flex-col gap-5">
          <Panel
            title={chosen && chosen.pseudo !== me ? `Floods à lancer · ${chosen.pseudo}` : "Vos floods à lancer"}
            aside={chosen ? `${chosen.pseudo} · ${roleLabel(roleOf(chosen.id))}` : undefined}
            flush
          >
            {mine.length === 0 ? (
              <p className="px-4 py-3 text-muted-foreground">
                Rien à lancer dans les {choice.horizon} prochaines heures.
              </p>
            ) : (
              mine.map((launch, index) => (
                <div
                  key={launch.n}
                  className={cn(
                    "grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 px-4 py-3 sm:grid-cols-[2rem_minmax(0,1fr)_auto]",
                    index > 0 && "border-t",
                  )}
                >
                  <span className="font-mono text-xl text-primary">{launch.n}</span>
                  <div className="min-w-0 space-y-1">
                    <div>
                      <strong className="text-base">→ {name(launch.targetId)}</strong>{" "}
                      <span className="text-muted-foreground">{roleLabel(roleOf(launch.targetId))}</span> ·{" "}
                      <span className="font-mono">{formatNumber(launch.take)}</span> fourmis
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[0.8125rem]">
                      <span>
                        <span className={FIELD_LABEL + " inline"}>Partir</span>{" "}
                        <strong>{departWindow(launch, now)}</strong>
                      </span>
                      <span>
                        <span className={FIELD_LABEL + " inline"}>Arrivée</span>{" "}
                        {formatEndTime(new Date(launch.arrival), now)}
                      </span>
                      <span>
                        <span className={FIELD_LABEL + " inline"}>Son TDC</span>{" "}
                        <span className="font-mono">
                          {formatNumber(launch.targetBefore)} → {formatNumber(launch.targetAfter)}
                        </span>
                      </span>
                      <span>
                        <span className={FIELD_LABEL + " inline"}>Le vôtre</span>{" "}
                        <span className="font-mono">
                          {formatNumber(launch.attackerBefore)} → {formatNumber(launch.attackerAfter)}
                        </span>
                      </span>
                    </div>
                    {launch.departFrom === launch.departTo && (
                      <p className="text-xs text-muted-foreground">
                        Partez à l&apos;heure : le flood suivant qui vous concerne, vous ou {name(launch.targetId)},
                        arrive une minute après.
                      </p>
                    )}
                  </div>
                  {origin && (
                    <a
                      href={`${origin}/ennemie.php?Attaquer=${String(launch.targetId)}&lieu=1`}
                      target="_blank"
                      rel="noreferrer"
                      className="col-start-2 inline-flex h-9 items-center justify-center bg-primary px-3.5 font-semibold text-primary-foreground hover:opacity-90 sm:col-start-3 sm:row-start-1"
                    >
                      Attaquer dans le jeu
                    </a>
                  )}
                </div>
              ))
            )}
          </Panel>

          {(plan.gaps.length > 0 || plan.dropped > 0) && (
            <Panel title="Ce qui ne passe pas">
              {plan.gaps.map((gap) => {
                const needed = bridge(plan.fieldAt(gap.below, later), plan.fieldAt(gap.above, later), CHAIN_MARGIN);
                return (
                  <p key={gap.from}>
                    Rien ne monte de <strong>{name(gap.from)}</strong> vers {name(gap.above)} :{" "}
                    {gap.reason === "attacks"
                      ? "les membres à portée n'ont plus d'attaque libre."
                      : "min" in needed
                        ? `il manque un passeur de ${formatNumber(needed.min)} à ${formatNumber(needed.max)} cm², entre ${name(gap.below)} et ${name(gap.above)}.`
                        : `il manque ${String(needed.passers)} passeurs entre ${name(gap.below)} et ${name(gap.above)}.`}
                  </p>
                );
              })}
              {plan.dropped > 0 && (
                <p>
                  {plan.dropped === 1 ? "Un transfert arriverait" : `${String(plan.dropped)} transferts arriveraient`}{" "}
                  après l&apos;horizon : allongez-le pour le voir.
                </p>
              )}
            </Panel>
          )}

          <Panel
            title="Floods sur chaque membre"
            aside="dans l'ordre d'arrivée · un flood ne passe jamais devant un autre"
            flush
          >
            <QueueTables
              members={[...inChain].sort((a, b) => height(roleOf(a.id)) - height(roleOf(b.id)) || a.id - b.id)}
              floods={plan.projection.floods}
              launches={plan.launches}
              name={name}
              roleOf={roleOf}
              now={now}
            />
          </Panel>
        </div>

        <div className="flex min-w-0 flex-[1_1_20rem] flex-col gap-5">
          {alerts.length > 0 && (
            <Callout tone="warning">
              {alerts.length === 1 ? "Un flood en route" : `${String(alerts.length)} floods en route`} posent problème :
              voyez la file de leur cible.
            </Callout>
          )}
          <Panel title="TDC des membres" aside={`maintenant → dans ${String(choice.horizon)} h`} flush>
            <Table>
              <TableBody>
                {[...inChain]
                  .sort((a, b) => height(roleOf(b.id)) - height(roleOf(a.id)) || a.id - b.id)
                  .map((m) => {
                    const fieldNow = plan.fieldAt(m.id, now.getTime());
                    const fieldLater = plan.fieldAt(m.id, later);
                    const source = sources.get(m.id);
                    return (
                      <TableRow key={m.id}>
                        <TableCell className="pl-4">
                          <div className="font-semibold">{m.pseudo}</div>
                          <div className="text-xs text-muted-foreground">{roleLabel(roleOf(m.id))}</div>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatNumber(fieldNow)}
                          {source && (
                            <div className="text-[0.6875rem] text-muted-foreground">
                              {source.approx ? "export ≈ " : ""}
                              {formatPastTime(new Date(source.at), now)}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="pr-4 text-right font-mono whitespace-nowrap">
                          {fieldLater > fieldNow ? "▲ " : fieldLater < fieldNow ? "▼ " : ""}
                          {formatNumber(fieldLater)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </Panel>
          <Panel title="Règles">
            <ul className="list-disc space-y-1 pl-4 text-[0.8125rem]">
              <li>Prise : 20 % du TDC de la cible à l&apos;arrivée, ou la plus grosse qui la garde à portée.</li>
              <li>Portée vérifiée à l&apos;arrivée, avec les TDC de ce moment : 50 % (+1 % de marge) à 300 %.</li>
              <li>
                Un flood à lancer arrive après tous ceux déjà en route sur sa cible et sur son attaquant : il ne change
                jamais leur prise.
              </li>
              <li>
                Attaques libres : Vitesse d&apos;attaque + 1, moins celles en route ; prise plafonnée à l&apos;armée
                connue.
              </li>
            </ul>
          </Panel>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Plan calculé dans ce navigateur avec la Clé d&apos;alliance ; le site ne voit ni les TDC ni les prises. Rien
        n&apos;est lancé pour vous : «&nbsp;Attaquer dans le jeu&nbsp;» ouvre le formulaire, où le Plan de flood de
        l&apos;extension remplit l&apos;armée.
      </p>
    </div>
  );
}

/** Each member's floods, on their way and to launch, landing on them or sent by them, by arrival. */
function QueueTables({
  members,
  floods,
  launches,
  name,
  roleOf,
  now,
}: {
  members: readonly PassageRosterMember[];
  floods: readonly ProjectedFlood[];
  launches: readonly Launch[];
  name: (id: number) => string;
  roleOf: (id: number) => Role;
  now: Date;
}) {
  const rows = members
    .map((m) => {
      const pseudo = m.pseudo.toLowerCase();
      const onWay = floods
        .filter((f) => f.target.toLowerCase() === pseudo)
        .map((f) => ({ at: f.at, flood: f, launch: null as Launch | null }));
      const planned = launches
        .filter((l) => l.targetId === m.id)
        .map((l) => ({ at: l.arrival, flood: null as ProjectedFlood | null, launch: l }));
      return { member: m, events: [...onWay, ...planned].sort((a, b) => a.at - b.at) };
    })
    .filter((row) => row.events.length > 0);

  if (rows.length === 0)
    return <p className="px-4 py-3 text-muted-foreground">Aucun flood en route ni à lancer sur les membres.</p>;

  return rows.map(({ member, events }, index) => (
    <section key={member.id} aria-label={`Floods sur ${member.pseudo}`} className={cn(index > 0 && "border-t")}>
      <h3 className="px-4 pt-2.5 pb-1">
        <strong>{member.pseudo}</strong> <span className="text-muted-foreground">{roleLabel(roleOf(member.id))}</span>
      </h3>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Arrivée</TableHead>
              <TableHead>De</TableHead>
              <TableHead className="text-right">Prise</TableHead>
              <TableHead className="hidden sm:table-cell">Son TDC</TableHead>
              <TableHead className="pr-4">État</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.map(({ at, flood, launch }) => {
              const fails = flood?.status === "fails";
              const state = flood ? floodState(flood) : null;
              return (
                <TableRow key={`${String(at)}-${flood?.from ?? String(launch?.n)}`}>
                  <TableCell className="pl-4 font-mono whitespace-nowrap">
                    {formatEndTimeShort(new Date(at), now)}
                  </TableCell>
                  <TableCell className="font-semibold">{flood ? flood.from : name(launch?.attackerId ?? 0)}</TableCell>
                  <TableCell className={cn("text-right font-mono", fails && "line-through")}>
                    {formatNumber(flood ? flood.expected : (launch?.take ?? 0))}
                  </TableCell>
                  <TableCell className="hidden font-mono whitespace-nowrap sm:table-cell">
                    {flood
                      ? `${formatNumber(flood.targetBefore)} → ${formatNumber(flood.targetAfter)}`
                      : `${formatNumber(launch?.targetBefore ?? 0)} → ${formatNumber(launch?.targetAfter ?? 0)}`}
                  </TableCell>
                  <TableCell className="pr-4">
                    {state ? (
                      <Pill tone={state.tone}>{state.text}</Pill>
                    ) : (
                      <Pill tone="todo">à lancer · n° {launch?.n}</Pill>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </section>
  ));
}
