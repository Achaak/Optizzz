"use client";

// The « Demandes » tab of a space (docs/features/site-demandes.md): make a Demande, the Demandes to validate (an Admin
// or a Délégué decides), those waiting for convoys with what remains to send, and those finished in the last 90 days.
// A status is written in words, never told by a colour alone (ADR 0003). « Envoyer un convoi » opens the game's
// Convoi page, which the extension fills: the player clicks « Lancer le convoi » themself.
import { formatCompact, formatNumber } from "@optizzz/game/format/number-format";
import {
  formatDateTime,
  formatEndTime,
  formatPastTime,
  fromParisParts,
  parisParts,
} from "@optizzz/game/format/time-format";
import { parseGameDuration } from "@optizzz/game/pages/work-queue";
import type { LevelKey } from "@optizzz/game/level-costs";
import { BUILDINGS, RESEARCH } from "@optizzz/game/levels";
import { serverById } from "@optizzz/game/servers";
import {
  askedOf,
  demandeConvoyLink,
  MAX_DEMANDE_LEVEL,
  needsRevalidation,
  STATUS_LABEL,
  tableCost,
  wantedText,
  type AttachedConvoy,
  type DemandeContent,
  type DemandeConvoy,
  type Resources,
} from "@optizzz/game/site-links/demandes";
import type { MemberStates } from "@optizzz/game/sharing/shared-state";
import type { ConvoyItem } from "@optizzz/game/site-links/envoi-convoys";
import { prioriteText, type Priorite } from "@optizzz/game/site-links/priorite";
import { cn } from "cn";
import { Fragment, useId, useState } from "react";
import { ArrowRightIcon } from "~/components/icons";
import { NumberField } from "~/components/number-field";
import { Stat } from "~/components/stat";
import { Button, buttonVariants } from "~/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { canDecide, groupDemandes, requesterPriorites, type OpenedDemande } from "~/lib/demandes/demandes";
import { errorText } from "./errors";
import { Callout, FIELD_INPUT, FIELD_LABEL, Panel } from "./parts";
import type { MemberView } from "./use-space-access";
import type { SpaceDemandes } from "./use-space-demandes";

const LEVEL_RULES = { integer: true, min: 0, max: MAX_DEMANDE_LEVEL, allowEmpty: true } as const;
const AMOUNT_RULES = { integer: true, min: 0, amount: true, allowEmpty: true } as const;

/** « 120 000 matériaux », « 5 000 nourriture et 40 000 matériaux », « rien ». */
function resources({ food, materials }: Resources): string {
  const parts = [
    ...(food > 0 ? [`${formatNumber(food)} nourriture`] : []),
    ...(materials > 0 ? [`${formatNumber(materials)} matériaux`] : []),
  ];
  return parts.length === 0 ? "rien" : parts.join(" et ");
}

/** Food and materials together, the one figure a summary shows. */
const total = ({ food, materials }: Resources) => food + materials;

/** The columns' heads in small mono capitals, as the site's tables write them. */
const HEAD_ROW =
  "border-b-0 font-mono text-[0.6875rem] tracking-widest text-muted-foreground uppercase hover:bg-transparent";
const HEAD = "h-8 font-medium text-muted-foreground";
const ROW = "border-t border-b-0";

/** Food and materials together in mono, each one under it when both are asked. */
function Cost({ resources: asked }: { resources: Resources }) {
  return (
    <>
      <span className="font-mono">{formatNumber(total(asked))}</span>
      {asked.food > 0 && asked.materials > 0 && (
        <span className="block text-xs text-muted-foreground">{resources(asked)}</span>
      )}
    </>
  );
}

/** How much of a Demande is received or on its way: a bar with its percentage written beside it (ADR 0003). */
function Progress({ part, whole }: { part: number; whole: number }) {
  const percent = whole > 0 ? Math.min(100, Math.round((part / whole) * 100)) : 0;
  return (
    <div className="flex items-center justify-end gap-2">
      <div aria-hidden className="h-2 w-16 bg-raised">
        <div className="h-full bg-info" style={{ width: `${String(percent)}%` }} />
      </div>
      <span className="w-10 text-right font-mono text-xs">{percent} %</span>
    </div>
  );
}

const plus = (a: Resources, b: Resources): Resources => ({
  food: a.food + b.food,
  materials: a.materials + b.materials,
});

/** What the Priorité comes from, or what it misses: « Solde 4 600 000 · Production 250 000 / jour ». */
function prioriteDetail(priorite: Priorite): string {
  const solde = (value: number) => `Solde ${formatNumber(value)}`;
  const production = (value: number, atLeast = false) =>
    `Production ${atLeast ? "≥ " : ""}${formatNumber(value)} / jour`;
  switch (priorite.kind) {
    case "known":
      return `${solde(priorite.solde)} · ${production(priorite.production, priorite.atLeast)}`;
    case "no-production":
      return `${solde(priorite.solde)} · ${production(0)}`;
    default:
      return [
        priorite.solde === null ? "Convois non envoyés" : solde(priorite.solde),
        priorite.missing.includes("production")
          ? priorite.production === null
            ? "Production non envoyée"
            : `Production inconnue (colonies non lues)`
          : production(priorite.production ?? 0),
      ].join(" · ");
  }
}

/** The requester's Priorité in days, with its Solde and Production; « … » while the Envois are being opened. */
function PrioriteCell({ priorite }: { priorite: Priorite | undefined }) {
  if (!priorite) return <span className="text-muted-foreground">…</span>;
  return (
    <>
      <span className={priorite.kind === "known" ? "font-medium tabular-nums" : "text-muted-foreground"}>
        {prioriteText(priorite)}
      </span>
      <span className="block text-xs text-muted-foreground tabular-nums">{prioriteDetail(priorite)}</span>
    </>
  );
}

function PrioriteNote() {
  return (
    <p className="text-xs text-muted-foreground">
      Les Demandes sont classées par Priorité, la plus basse d&apos;abord&nbsp;: le Solde du demandeur (convois reçus
      moins envoyés sur les 30 derniers jours, nourriture et matériaux additionnés) divisé par sa Production (colonies
      comprises), soit combien de jours de sa propre production il a déjà reçus. Une Priorité inconnue passe en dernier.
      C&apos;est un classement, pas une décision&nbsp;: rien n&apos;est validé ni refusé tout seul.
    </p>
  );
}

/** « pour le 05/11 », « autofinancée », « coût saisi »: what the Demande says besides its label. */
function DemandeTags({ content }: { content: DemandeContent }) {
  const tags = [
    content.wanted !== undefined && wantedText(content.wanted),
    content.self && "autofinancée",
    content.typed && "coût saisi",
  ].filter(Boolean);
  return tags.length === 0 ? null : <span className="block text-xs text-muted-foreground">{tags.join(" · ")}</span>;
}

/** A Paris day for `<input type="date">`, and back. */
const dayInput = (wanted: number | undefined) => {
  if (wanted === undefined) return "";
  const { year, month, day } = parisParts(new Date(wanted));
  return `${String(year)}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};
const dayOf = (value: string): number | undefined => {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return undefined;
  return fromParisParts({ year, month, day, hours: 0, minutes: 0 }).getTime();
};

export function DemandesPanel({
  view,
  demandes,
  sends,
  convoys,
  states,
  loading,
  onShowConvoys,
}: {
  view: MemberView;
  demandes: SpaceDemandes;
  /** What each member sends: making a Demande asks for Production and Convois. */
  sends: readonly { playerId: number; categories: string[] }[];
  /** The alliance's convoys and states, opened on this page (null until then): the requesters' Priorité. */
  convoys: readonly ConvoyItem[] | null;
  states: readonly MemberStates[] | null;
  loading: boolean;
  /** « Voir les convois »: the space's « Convois » tab. */
  onShowConvoys: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // The Demande whose « Modifier » or « Déclarer un convoi » form is open under its row.
  const [unfolded, setUnfolded] = useState<{ id: string; form: "change" | "declare" } | null>(null);
  const myPseudo = view.members.find((m) => m.playerId === view.me.playerId)?.pseudo ?? "";

  if (demandes.demandes === null)
    return (
      <Panel title="Demandes">
        <p className="text-muted-foreground">
          {loading || demandes.loading
            ? "Lecture des Demandes…"
            : "Ouvrez l'accès à l'espace sur cet appareil (onglet « Espace ») pour lire les Demandes de l'alliance."}
        </p>
      </Panel>
    );

  const mine = (d: OpenedDemande) => d.playerId === view.me.playerId;
  // Worked out here, from the Envois this page opened: the site never sees an amount.
  const requesters = [...new Map(demandes.demandes.map((d) => [d.playerId, d.requester]))].map(
    ([playerId, pseudo]) => ({ playerId, pseudo }),
  );
  const priorites =
    convoys && states ? requesterPriorites(requesters, { convoys, states, sends }, new Date()) : undefined;
  const groups = groupDemandes(demandes.demandes, priorites);
  const myOpen = [...groups.pending, ...groups.active].filter(mine).sort((a, b) => a.rank - b.rank);
  const origin = serverById(view.space.server)?.origin ?? null;
  const categories = sends.find((s) => s.playerId === view.me.playerId)?.categories ?? [];
  const canAsk = categories.includes("production") && categories.includes("convoys");

  /** Whether it went through; what went wrong is said above the lists. */
  async function run(action: () => Promise<unknown>): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      await action();
      return true;
    } catch (failure) {
      setError(errorText(failure));
      return false;
    } finally {
      setBusy(false);
    }
  }

  /** ↑ or ↓ among the member's open Demandes. */
  function move(demande: OpenedDemande, by: -1 | 1) {
    const ids = myOpen.map((d) => d.id);
    const at = ids.indexOf(demande.id);
    const other = ids[at + by];
    if (at < 0 || other === undefined) return;
    ids[at + by] = demande.id;
    ids[at] = other;
    void run(() => demandes.reorder(ids));
  }

  const ownActions = (demande: OpenedDemande) => {
    const at = myOpen.findIndex((d) => d.id === demande.id);
    return (
      <div className="flex flex-wrap justify-end gap-1.5">
        <Button
          variant="outline"
          size="icon"
          disabled={busy || at <= 0}
          aria-label={`Monter ${demande.label}`}
          onClick={() => move(demande, -1)}
        >
          ↑
        </Button>
        <Button
          variant="outline"
          size="icon"
          disabled={busy || at < 0 || at >= myOpen.length - 1}
          aria-label={`Descendre ${demande.label}`}
          onClick={() => move(demande, 1)}
        >
          ↓
        </Button>
        <Button variant="outline" disabled={busy} onClick={() => toggle(demande.id, "change")}>
          Modifier
        </Button>
        <Button variant="outline" disabled={busy} onClick={() => void run(() => demandes.finish(demande.id))}>
          Clore
        </Button>
        <Button variant="outline" disabled={busy} onClick={() => void run(() => demandes.cancel(demande.id))}>
          Annuler
        </Button>
      </div>
    );
  };

  const toggle = (id: string, form: "change" | "declare") =>
    setUnfolded((current) => (current?.id === id && current.form === form ? null : { id, form }));
  const validator = view.me.role === "admin" || view.me.role === "delegate";

  /** What a validator does to a validated Demande: send it back to validation, or close it. */
  const validatorActions = (demande: OpenedDemande) => (
    <>
      {canDecide(view.me.role, mine(demande)) && (
        <Button variant="outline" disabled={busy} onClick={() => void run(() => demandes.suspend(demande.id))}>
          Suspendre
        </Button>
      )}
      {!mine(demande) && validator && (
        <Button variant="outline" disabled={busy} onClick={() => void run(() => demandes.finish(demande.id))}>
          Clore
        </Button>
      )}
    </>
  );

  /** The form unfolded under a Demande's row, if any. */
  const unfoldedRow = (demande: OpenedDemande, columns: number) => {
    if (unfolded?.id !== demande.id) return null;
    const close = () => setUnfolded(null);
    return (
      <TableRow className="border-t border-b-0 border-dashed bg-muted hover:bg-muted">
        <TableCell colSpan={columns} className="px-4 py-3 whitespace-normal">
          {unfolded.form === "change" ? (
            <ChangeForm
              demande={demande}
              busy={busy}
              onClose={close}
              onChange={async (content) => {
                if (await run(() => demandes.change(demande, content))) close();
              }}
            />
          ) : (
            <DeclareForm
              demande={demande}
              me={myPseudo}
              busy={busy}
              onClose={close}
              onDeclare={async (convoy) => {
                if (await run(() => demandes.declare(convoy))) close();
              }}
            />
          )}
        </TableCell>
      </TableRow>
    );
  };

  /** The convoys the member declared for a Demande, each withdrawn until it arrives. */
  const myDeclared = (demande: OpenedDemande) =>
    (demandes.convoys ?? []).filter(
      (c): c is AttachedConvoy & { declared: NonNullable<AttachedConvoy["declared"]> } =>
        c.demande === demande.id && c.declared?.playerId === view.me.playerId,
    );

  // An « autofinancée » Demande asks for nothing: it stays out of what remains to send.
  const remaining = groups.active.reduce((sum, d) => sum + total(askedOf(d.content, d.progress.remaining)), 0);
  const now = new Date();

  return (
    <div className="space-y-5">
      <section
        aria-label="Demandes de l'espace"
        className="grid grid-cols-2 border-t border-l bg-card sm:grid-cols-[repeat(auto-fit,minmax(10rem,1fr))]"
      >
        <Stat
          label="À valider"
          value={formatNumber(groups.pending.length)}
          hint="Demandes"
          tone={groups.pending.length > 0 ? "accent" : undefined}
        />
        <Stat label="Validées" value={formatNumber(groups.active.length)} hint="en cours d'envoi" />
        <Stat label="Reste à envoyer" value={formatCompact(remaining)} hint="nourriture et matériaux" />
        <Stat label="Terminées" value={formatNumber(groups.finished.length)} hint="ces 90 derniers jours" />
      </section>

      <div className="flex flex-wrap items-start gap-5">
        <div className="flex min-w-0 flex-[999_1_40rem] flex-col gap-5">
          {error && <Callout>{error}</Callout>}
          {demandes.refused > 0 && (
            <Callout tone="warning">
              {demandes.refused === 1
                ? "Une Demande ne s'ouvre pas"
                : `${formatNumber(demandes.refused)} Demandes ne s'ouvrent pas`}{" "}
              : modifiée hors du navigateur d&apos;un membre, ou chiffrée avec une version de l&apos;accès que vous
              n&apos;avez pas. Elle n&apos;est pas montrée.
            </Callout>
          )}

          <Panel
            title="À valider"
            aside={<span className="text-xs text-muted-foreground">nourriture + matériaux</span>}
            flush
          >
            {groups.pending.length === 0 ? (
              <p className="px-4 pt-4 text-muted-foreground">Aucune Demande n&apos;attend d&apos;être validée.</p>
            ) : (
              <Table className="text-[0.8125rem]">
                <TableHeader>
                  <TableRow className={HEAD_ROW}>
                    <TableHead className={cn(HEAD, "pl-4")}>Demandeur</TableHead>
                    <TableHead className={HEAD}>Demande</TableHead>
                    <TableHead className={cn(HEAD, "text-right")}>Coût</TableHead>
                    <TableHead className={HEAD}>Priorité</TableHead>
                    <TableHead className={HEAD}>Faite le</TableHead>
                    <TableHead className={cn(HEAD, "pr-4")}>
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groups.pending.map((d) => (
                    <Fragment key={d.id}>
                      <TableRow className={ROW}>
                        <TableCell className="pl-4 font-semibold">{d.requester}</TableCell>
                        <TableCell className="min-w-32 whitespace-normal">
                          {d.label}
                          <DemandeTags content={d.content} />
                          {d.decidedByPseudo && (
                            <span className="block text-xs text-muted-foreground">
                              suspendue par {d.decidedByPseudo}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Cost resources={d.content.cost} />
                        </TableCell>
                        <TableCell className="min-w-40 whitespace-normal">
                          <PrioriteCell priorite={priorites?.get(d.playerId)} />
                        </TableCell>
                        <TableCell>{formatPastTime(new Date(d.createdAt), now)}</TableCell>
                        <TableCell className="min-w-44 pr-4 whitespace-normal">
                          <div className="flex flex-wrap justify-end gap-1.5">
                            {mine(d) && ownActions(d)}
                            {canDecide(view.me.role, mine(d)) && (
                              <>
                                <Button
                                  variant="outline"
                                  disabled={busy}
                                  onClick={() => void run(() => demandes.decide(d.id, "refused"))}
                                >
                                  Refuser
                                </Button>
                                <Button
                                  className="font-semibold"
                                  disabled={busy}
                                  onClick={() => void run(() => demandes.decide(d.id, "validated"))}
                                >
                                  Valider
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                      {unfoldedRow(d, 6)}
                    </Fragment>
                  ))}
                </TableBody>
              </Table>
            )}
            <Notes>
              <p>
                Un Admin ou un Délégué valide une Demande, jamais la sienne. Le coût vient de la table des coûts
                d&apos;Optizzz, sauf quand le demandeur l&apos;a saisi. Elles sont classées par Priorité, comme les
                validées.
              </p>
            </Notes>
          </Panel>

          <Panel
            title="Validées, en cours d'envoi"
            aside={
              <button
                type="button"
                onClick={onShowConvoys}
                className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
              >
                Voir les convois
                <ArrowRightIcon width={14} height={14} />
              </button>
            }
            flush
          >
            {groups.active.length === 0 ? (
              <p className="px-4 pt-4 text-muted-foreground">Aucune Demande validée en cours.</p>
            ) : (
              <Table className="text-[0.8125rem]">
                <TableHeader>
                  <TableRow className={HEAD_ROW}>
                    <TableHead className={cn(HEAD, "pl-4")}>Demandeur</TableHead>
                    <TableHead className={HEAD}>Demande</TableHead>
                    <TableHead className={HEAD}>Priorité</TableHead>
                    <TableHead className={cn(HEAD, "text-right")}>Reste à envoyer</TableHead>
                    <TableHead className={cn(HEAD, "text-right")}>Envoyé</TableHead>
                    <TableHead className={HEAD}>État</TableHead>
                    <TableHead className={cn(HEAD, "pr-4")}>
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groups.active.map((d) => (
                    <Fragment key={d.id}>
                      <TableRow className={ROW}>
                        <TableCell className="pl-4 font-semibold">{d.requester}</TableCell>
                        <TableCell className="min-w-32 whitespace-normal">
                          {d.label}
                          <DemandeTags content={d.content} />
                          {myDeclared(d).map((c) => (
                            <span key={c.declared.fingerprint} className="block text-xs text-muted-foreground">
                              Déclaré par vous : {resources(c)}, arrivée {formatEndTime(new Date(c.at), now)}
                              {c.at > now.getTime() && (
                                <>
                                  {" · "}
                                  <button
                                    type="button"
                                    disabled={busy}
                                    className="font-semibold text-primary hover:underline"
                                    onClick={() => void run(() => demandes.withdraw(c.declared.fingerprint))}
                                  >
                                    Retirer
                                  </button>
                                </>
                              )}
                            </span>
                          ))}
                        </TableCell>
                        <TableCell className="min-w-40 whitespace-normal">
                          <PrioriteCell priorite={priorites?.get(d.playerId)} />
                        </TableCell>
                        <TableCell className="text-right">
                          {d.content.self ? (
                            <span className="text-muted-foreground">autofinancée</span>
                          ) : (
                            <>
                              <Cost resources={d.progress.remaining} />
                              <span className="block text-xs text-muted-foreground">
                                sur {formatNumber(total(d.content.cost))}
                              </span>
                            </>
                          )}
                        </TableCell>
                        <TableCell>
                          {d.content.self ? (
                            <span className="block text-right text-muted-foreground">—</span>
                          ) : (
                            <Progress
                              part={total(plus(d.progress.received, d.progress.onWay))}
                              whole={total(d.content.cost)}
                            />
                          )}
                        </TableCell>
                        <TableCell className={d.status === "covered" ? "text-muted-foreground" : "font-medium"}>
                          {STATUS_LABEL[d.status]}
                        </TableCell>
                        <TableCell className="min-w-44 pr-4 whitespace-normal">
                          <div className="flex flex-wrap justify-end gap-1.5">
                            {mine(d) && ownActions(d)}
                            {!mine(d) && !d.content.self && d.status === "validated" && origin && (
                              <a
                                href={demandeConvoyLink(origin, d.id)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={buttonVariants({ variant: "outline" })}
                              >
                                Envoyer un convoi
                              </a>
                            )}
                            {!mine(d) && !d.content.self && d.status === "validated" && (
                              <Button
                                variant="outline"
                                aria-expanded={unfolded?.id === d.id && unfolded.form === "declare"}
                                disabled={busy}
                                onClick={() => toggle(d.id, "declare")}
                              >
                                Déclarer un convoi
                              </Button>
                            )}
                            {validatorActions(d)}
                          </div>
                        </TableCell>
                      </TableRow>
                      {unfoldedRow(d, 7)}
                    </Fragment>
                  ))}
                </TableBody>
              </Table>
            )}
            <Notes>
              <PrioriteNote />
              <p>
                «&nbsp;Envoyé&nbsp;» compte les convois reçus et en route. «&nbsp;Envoyer un convoi&nbsp;» ouvre la page
                Commerce du jeu, que l&apos;extension Optizzz remplit avec le destinataire et le reste à envoyer&nbsp;:
                vérifiez, puis cliquez vous-même «&nbsp;Lancer le convoi&nbsp;». Ce convoi compte alors pour la Demande,
                si vous envoyez vos Convois ; un convoi lancé autrement se déclare avec «&nbsp;Déclarer un convoi&nbsp;»
                (il compte alors pour la Demande, pas dans le Solde). Une Demande est couverte quand les convois reçus
                et en route atteignent son coût, et close quand l&apos;extension du demandeur voit le niveau atteint ou
                le chantier lancé, ou à la main avec «&nbsp;Clore&nbsp;».
              </p>
              <p>
                «&nbsp;Suspendre&nbsp;» renvoie une Demande à valider. Une Demande autofinancée ne demande aucun convoi.
              </p>
            </Notes>
          </Panel>

          <FinishedPanel finished={groups.finished} />
        </div>

        <div className="flex min-w-0 flex-[1_1_20rem] flex-col gap-5">
          <Panel title="Faire une Demande">
            {canAsk ? (
              <DemandeForm busy={busy} onMake={(content) => run(() => demandes.make(content))} />
            ) : (
              <Callout tone="info">
                Pour faire une Demande, envoyez d&apos;abord Production et Convois depuis l&apos;extension
                (Fonctionnalités › Compte Optizzz)&nbsp;: les membres voient ainsi ce que vous produisez et recevez.
              </Callout>
            )}
            {myOpen.length > 1 && (
              <p className="text-muted-foreground">
                Vos Demandes ouvertes se rangent avec ↑ et ↓&nbsp;: la première est celle qui compte le plus pour vous.
              </p>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

/** The small print under a table. */
function Notes({ children }: { children: React.ReactNode }) {
  return <div className="space-y-2 px-4 py-3 text-xs text-muted-foreground">{children}</div>;
}

/** The ended Demandes, folded: how many and of what kind, the list on « Afficher ». */
function FinishedPanel({ finished }: { finished: readonly OpenedDemande[] }) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const byStatus = (["closed", "refused", "cancelled"] as const)
    .map((status) => ({ status, count: finished.filter((d) => d.status === status).length }))
    .filter(({ count }) => count > 0)
    .map(({ status, count }) => `${formatNumber(count)} ${STATUS_LABEL[status]}${count > 1 ? "s" : ""}`);
  return (
    <Panel title="Terminées (90 derniers jours)" flush>
      <p className="px-4 py-3 text-muted-foreground">
        {finished.length === 0 ? (
          "Aucune Demande terminée."
        ) : (
          <>
            {formatNumber(finished.length)} Demande{finished.length > 1 ? "s" : ""} terminée
            {finished.length > 1 ? "s" : ""}
            {byStatus.length > 0 && ` · ${byStatus.join(", ")}`} ·{" "}
            <button
              type="button"
              aria-expanded={open}
              aria-controls={listId}
              onClick={() => setOpen(!open)}
              className="text-[0.8125rem] font-semibold text-primary hover:underline"
            >
              {open ? "Masquer" : "Afficher"}
            </button>
          </>
        )}
      </p>
      {open && finished.length > 0 && (
        <div id={listId} className="border-t">
          <Table className="text-[0.8125rem]">
            <TableHeader>
              <TableRow className={HEAD_ROW}>
                <TableHead className={cn(HEAD, "pl-4")}>Demandeur</TableHead>
                <TableHead className={HEAD}>Demande</TableHead>
                <TableHead className={HEAD}>État</TableHead>
                <TableHead className={cn(HEAD, "pr-4")}>Le</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {finished.map((d) => (
                <TableRow key={d.id} className={ROW}>
                  <TableCell className="pl-4 font-semibold">{d.requester}</TableCell>
                  <TableCell className="min-w-32 whitespace-normal">{d.label}</TableCell>
                  <TableCell>
                    {STATUS_LABEL[d.status]}
                    {(d.stored === "refused" || d.stored === "closed") && d.decidedByPseudo
                      ? ` par ${d.decidedByPseudo}`
                      : ""}
                  </TableCell>
                  <TableCell className="pr-4">{d.endedAt ? formatDateTime(new Date(d.endedAt)) : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Panel>
  );
}

const nameOf = (key: LevelKey) => [...BUILDINGS, ...RESEARCH].find((entry) => entry.key === key)?.name ?? key;

/** The building or research, the levels, and the cost from the table, which the player may type over. */
function DemandeForm({ busy, onMake }: { busy: boolean; onMake: (content: DemandeContent) => Promise<boolean> }) {
  const ids = {
    element: useId(),
    from: useId(),
    to: useId(),
    food: useId(),
    materials: useId(),
    hint: useId(),
    wanted: useId(),
  };
  const [wanted, setWanted] = useState("");
  const [self, setSelf] = useState(false);
  const [key, setKey] = useState<LevelKey>("mushroom");
  const [level, setLevel] = useState<number | null>(null);
  const [from, setFrom] = useState<number | null>(null);
  const [typed, setTyped] = useState<Resources | null>(null);

  const held = from ?? (level !== null ? Math.max(0, level - 1) : null);
  const aim = level !== null && held !== null && level > held ? { from: held, level } : null;
  const table = aim ? tableCost(key, aim.from, aim.level) : null;
  const cost = typed ?? table;
  const aimed = aim !== null;

  async function make() {
    if (!aim || !cost || cost.food + cost.materials === 0) return;
    const day = dayOf(wanted);
    const content: DemandeContent = {
      key,
      ...aim,
      cost,
      typed: typed !== null,
      ...(day !== undefined && { wanted: day }),
      ...(self && { self }),
    };
    if (!(await onMake(content))) return;
    setLevel(null);
    setFrom(null);
    setTyped(null);
    setWanted("");
    setSelf(false);
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1">
          <label htmlFor={ids.element} className={FIELD_LABEL}>
            Bâtiment ou recherche
          </label>
          <select
            id={ids.element}
            value={key}
            onChange={(event) => {
              setKey(event.target.value as LevelKey);
              setTyped(null);
            }}
            className={cn("block w-full border border-input px-2.5 text-sm", FIELD_INPUT)}
          >
            <optgroup label="Bâtiments">
              {BUILDINGS.map((b) => (
                <option key={b.key} value={b.key}>
                  {b.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="Recherches">
              {RESEARCH.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.name}
                </option>
              ))}
            </optgroup>
          </select>
        </div>
        <div className="min-w-0 space-y-1">
          <label htmlFor={ids.to} className={FIELD_LABEL}>
            Niveau visé
          </label>
          <NumberField
            id={ids.to}
            className={FIELD_INPUT}
            value={level}
            rules={{ ...LEVEL_RULES, min: 1 }}
            onCommit={(value) => {
              setLevel(value);
              setTyped(null);
            }}
          />
        </div>
        <div className="min-w-0 space-y-1">
          <label htmlFor={ids.from} className={FIELD_LABEL}>
            Niveau actuel
          </label>
          <NumberField
            id={ids.from}
            className={FIELD_INPUT}
            placeholder={level !== null ? String(Math.max(0, level - 1)) : ""}
            value={from}
            rules={LEVEL_RULES}
            onCommit={(value) => {
              setFrom(value);
              setTyped(null);
            }}
          />
        </div>
        <div className="min-w-0 space-y-1">
          <label htmlFor={ids.food} className={FIELD_LABEL}>
            Nourriture
          </label>
          <NumberField
            id={ids.food}
            aria-describedby={ids.hint}
            className={FIELD_INPUT}
            value={cost?.food ?? null}
            rules={AMOUNT_RULES}
            onCommit={(value) => setTyped({ food: value ?? 0, materials: cost?.materials ?? 0 })}
          />
        </div>
        <div className="min-w-0 space-y-1">
          <label htmlFor={ids.materials} className={FIELD_LABEL}>
            Matériaux
          </label>
          <NumberField
            id={ids.materials}
            aria-describedby={ids.hint}
            className={FIELD_INPUT}
            value={cost?.materials ?? null}
            rules={AMOUNT_RULES}
            onCommit={(value) => setTyped({ food: cost?.food ?? 0, materials: value ?? 0 })}
          />
        </div>
        <p id={ids.hint} className="col-span-2 text-xs text-muted-foreground">
          {!aimed
            ? "Choisissez un niveau visé au-dessus du niveau actuel."
            : typed
              ? "Coût saisi par vous : il sera montré comme tel aux validateurs."
              : `Coût de ${nameOf(key)} calculé d'après la table des coûts d'Optizzz, modifiable.`}{" "}
          Seuls la nourriture et les matériaux se demandent&nbsp;: un convoi ne porte pas d&apos;ouvrières.
        </p>
        <div className="col-span-2 space-y-1">
          <label htmlFor={ids.wanted} className={FIELD_LABEL}>
            Pour le
          </label>
          <input
            id={ids.wanted}
            type="date"
            value={wanted}
            onChange={(event) => setWanted(event.target.value)}
            className={cn("block w-full border border-input px-2.5 text-sm", FIELD_INPUT)}
          />
          <p className="text-xs text-muted-foreground">Facultatif : le jour où vous voulez lancer le chantier.</p>
        </div>
        <label className="col-span-2 flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            checked={self}
            onChange={(event) => setSelf(event.target.checked)}
            className="mt-1 size-4 accent-primary"
          />
          <span>
            Je la finance moi-même
            <span className="block text-xs text-muted-foreground">
              Autofinancée : la Demande annonce le chantier à l&apos;alliance et attend sa validation, sans demander de
              convoi.
            </span>
          </span>
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          className="h-9.5 px-3.5 font-semibold"
          disabled={busy || !aim || !cost || cost.food + cost.materials === 0}
          onClick={() => void make()}
        >
          Envoyer la Demande
        </Button>
        {typed && (
          <Button variant="outline" className="h-9.5" disabled={busy} onClick={() => setTyped(null)}>
            Reprendre la table des coûts
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Ce que vous demandez est chiffré dans votre navigateur avec la Clé d&apos;alliance&nbsp;: Optizzz ne voit que
        qui demande, quand, et où en est la Demande.
      </p>
    </div>
  );
}

/** « Modifier »: what the requester asks for, the day, and whether they pay it themself. */
function ChangeForm({
  demande,
  busy,
  onChange,
  onClose,
}: {
  demande: OpenedDemande;
  busy: boolean;
  onChange: (content: DemandeContent) => Promise<void>;
  onClose: () => void;
}) {
  const ids = { food: useId(), materials: useId(), wanted: useId() };
  const [cost, setCost] = useState<Resources>(demande.content.cost);
  const [wanted, setWanted] = useState(dayInput(demande.content.wanted));
  const [self, setSelf] = useState(Boolean(demande.content.self));
  const day = dayOf(wanted);
  const kept: DemandeContent = { ...demande.content };
  delete kept.wanted;
  delete kept.self;
  const content: DemandeContent = {
    ...kept,
    cost,
    typed: kept.typed || cost.food !== kept.cost.food || cost.materials !== kept.cost.materials,
    ...(day !== undefined && { wanted: day }),
    ...(self && { self }),
  };
  const back = demande.stored === "validated" && needsRevalidation(demande.content, content);
  return (
    <div className="space-y-3">
      <p className="text-[0.8125rem]">
        Modifier votre Demande ({demande.label}) : baisser ce qu&apos;elle demande la garde validée ; demander plus, un
        autre jour, ou la financer autrement la renvoie à valider.
      </p>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] items-end gap-3">
        <div className="space-y-1">
          <label htmlFor={ids.food} className={FIELD_LABEL}>
            Nourriture
          </label>
          <NumberField
            id={ids.food}
            className={FIELD_INPUT}
            value={cost.food}
            rules={AMOUNT_RULES}
            onCommit={(value) => setCost((current) => ({ ...current, food: value ?? 0 }))}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor={ids.materials} className={FIELD_LABEL}>
            Matériaux
          </label>
          <NumberField
            id={ids.materials}
            className={FIELD_INPUT}
            value={cost.materials}
            rules={AMOUNT_RULES}
            onCommit={(value) => setCost((current) => ({ ...current, materials: value ?? 0 }))}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor={ids.wanted} className={FIELD_LABEL}>
            Pour le
          </label>
          <input
            id={ids.wanted}
            type="date"
            value={wanted}
            onChange={(event) => setWanted(event.target.value)}
            className={cn("block w-full border border-input px-2.5 text-sm", FIELD_INPUT)}
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 pb-2">
          <input
            type="checkbox"
            checked={self}
            onChange={(event) => setSelf(event.target.checked)}
            className="size-4 accent-primary"
          />
          Autofinancée
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          className="font-semibold"
          disabled={busy || cost.food + cost.materials === 0}
          onClick={() => void onChange(content)}
        >
          {back ? "Enregistrer et renvoyer à valider" : "Enregistrer"}
        </Button>
        <Button variant="outline" disabled={busy} onClick={onClose}>
          Fermer
        </Button>
      </div>
    </div>
  );
}

/**
 * « Déclarer un convoi »: one the member sent to the requester without « Envoyer un convoi » (without the extension,
 * or launched in the game). It counts for the Demande, marked as declared.
 */
function DeclareForm({
  demande,
  me,
  busy,
  onDeclare,
  onClose,
}: {
  demande: OpenedDemande;
  me: string;
  busy: boolean;
  onDeclare: (convoy: DemandeConvoy) => Promise<void>;
  onClose: () => void;
}) {
  const ids = { food: useId(), materials: useId(), trip: useId(), hint: useId() };
  const left = demande.progress.remaining;
  const [amounts, setAmounts] = useState<Resources>(left);
  const [tripText, setTripText] = useState("");
  const duration = tripText.trim() === "0" ? 0 : parseGameDuration(tripText);
  const now = new Date();
  const arrival = duration === null ? null : new Date(now.getTime() + duration);
  const ready = arrival !== null && amounts.food + amounts.materials > 0;
  return (
    <div className="space-y-3">
      <p className="text-[0.8125rem]">
        Un convoi que vous avez lancé vers <strong>{demande.requester}</strong> sans «&nbsp;Envoyer un convoi&nbsp;» :
        il compte pour cette Demande, marqué «&nbsp;déclaré&nbsp;». Vous pouvez le retirer tant qu&apos;il n&apos;est
        pas arrivé.
      </p>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] items-end gap-3">
        <div className="space-y-1">
          <label htmlFor={ids.food} className={FIELD_LABEL}>
            Nourriture
          </label>
          <NumberField
            id={ids.food}
            className={FIELD_INPUT}
            value={amounts.food}
            rules={AMOUNT_RULES}
            onCommit={(value) => setAmounts((current) => ({ ...current, food: value ?? 0 }))}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor={ids.materials} className={FIELD_LABEL}>
            Matériaux
          </label>
          <NumberField
            id={ids.materials}
            className={FIELD_INPUT}
            value={amounts.materials}
            rules={AMOUNT_RULES}
            onCommit={(value) => setAmounts((current) => ({ ...current, materials: value ?? 0 }))}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor={ids.trip} className={FIELD_LABEL}>
            Arrivée dans
          </label>
          <input
            id={ids.trip}
            aria-describedby={ids.hint}
            value={tripText}
            placeholder="2h30m"
            onChange={(event) => setTripText(event.target.value)}
            className={cn("block w-full border border-input px-2.5 font-mono text-sm", FIELD_INPUT)}
          />
        </div>
      </div>
      <p id={ids.hint} className="text-xs text-muted-foreground">
        {arrival
          ? `Arrivée ${formatEndTime(arrival, now)}. 0 si le convoi est déjà arrivé.`
          : "La durée qui reste, comme le jeu l'écrit : « 2h30m », « 45m », « 0 » s'il est arrivé."}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          className="font-semibold"
          disabled={busy || !ready}
          onClick={() =>
            arrival &&
            void onDeclare({
              demande: demande.id,
              from: me,
              to: demande.requester,
              food: amounts.food,
              materials: amounts.materials,
              at: arrival.getTime(),
            })
          }
        >
          Déclarer
        </Button>
        <Button variant="outline" disabled={busy} onClick={onClose}>
          Fermer
        </Button>
      </div>
    </div>
  );
}
