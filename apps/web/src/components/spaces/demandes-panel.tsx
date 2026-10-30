"use client";

// The « Demandes » tab of a space (docs/features/site-demandes.md): make a Demande, the Demandes to validate (an Admin
// or a Délégué decides), those waiting for convoys with what remains to send, and those finished in the last 90 days.
// A status is written in words, never told by a colour alone (ADR 0003). « Envoyer un convoi » opens the game's
// Convoi page, which the extension fills: the player clicks « Lancer le convoi » themself.
import { formatNumber } from "@optizzz/game/format/number-format";
import { formatDateTime } from "@optizzz/game/format/time-format";
import type { LevelKey } from "@optizzz/game/level-costs";
import { BUILDINGS, RESEARCH } from "@optizzz/game/levels";
import { serverById } from "@optizzz/game/servers";
import {
  demandeConvoyLink,
  MAX_DEMANDE_LEVEL,
  STATUS_LABEL,
  tableCost,
  type Resources,
} from "@optizzz/game/site-links/demandes";
import type { MemberStates } from "@optizzz/game/sharing/shared-state";
import type { ConvoyItem } from "@optizzz/game/site-links/envoi-convoys";
import { prioriteText, type Priorite } from "@optizzz/game/site-links/priorite";
import { useId, useState } from "react";
import { NumberField } from "~/components/number-field";
import { Stat } from "~/components/stat";
import { Button, buttonVariants } from "~/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { canDecide, groupDemandes, requesterPriorites, type OpenedDemande } from "~/lib/demandes/demandes";
import { errorText } from "./errors";
import { Callout, Panel } from "./parts";
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

/** How much of a Demande is received or on its way: a bar with its percentage written beside it (ADR 0003). */
function Progress({ part, whole }: { part: number; whole: number }) {
  const percent = whole > 0 ? Math.min(100, Math.round((part / whole) * 100)) : 0;
  return (
    <div className="flex items-center justify-end gap-2">
      <div aria-hidden className="h-2 w-20 bg-muted">
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

export function DemandesPanel({
  view,
  demandes,
  sends,
  convoys,
  states,
  loading,
}: {
  view: MemberView;
  demandes: SpaceDemandes;
  /** What each member sends: making a Demande asks for Production and Convois. */
  sends: readonly { playerId: number; categories: string[] }[];
  /** The alliance's convoys and states, opened on this page (null until then): the requesters' Priorité. */
  convoys: readonly ConvoyItem[] | null;
  states: readonly MemberStates[] | null;
  loading: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
      <div className="flex flex-wrap gap-1.5">
        <Button
          size="sm"
          variant="outline"
          disabled={busy || at <= 0}
          aria-label={`Monter ${demande.label}`}
          onClick={() => move(demande, -1)}
        >
          ↑
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy || at < 0 || at >= myOpen.length - 1}
          aria-label={`Descendre ${demande.label}`}
          onClick={() => move(demande, 1)}
        >
          ↓
        </Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(() => demandes.cancel(demande.id))}>
          Annuler
        </Button>
      </div>
    );
  };

  const remaining = groups.active.reduce((sum, d) => sum + total(d.progress.remaining), 0);

  return (
    <div className="space-y-6">
      <section
        aria-label="Demandes de l'espace"
        className="grid grid-cols-2 border-t border-l bg-card sm:grid-cols-[repeat(auto-fit,minmax(10rem,1fr))]"
      >
        <Stat label="À valider" value={formatNumber(groups.pending.length)} hint="Demandes" />
        <Stat label="Validées" value={formatNumber(groups.active.length)} hint="en cours d'envoi" />
        <Stat label="Reste à envoyer" value={formatNumber(remaining)} hint="nourriture et matériaux" />
        <Stat label="Terminées" value={formatNumber(groups.finished.length)} hint="ces 90 derniers jours" />
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-6">
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

          <Panel title={`À valider (${String(groups.pending.length)})`}>
            {groups.pending.length === 0 ? (
              <p className="text-muted-foreground">Aucune Demande n&apos;attend d&apos;être validée.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Demandeur</TableHead>
                      <TableHead>Priorité</TableHead>
                      <TableHead>Demande</TableHead>
                      <TableHead>Coût</TableHead>
                      <TableHead>Faite le</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groups.pending.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell className="font-semibold">{d.requester}</TableCell>
                        <TableCell className="min-w-44 whitespace-normal">
                          <PrioriteCell priorite={priorites?.get(d.playerId)} />
                        </TableCell>
                        <TableCell>
                          {d.label}
                          {d.content.typed && <span className="block text-xs text-muted-foreground">coût saisi</span>}
                        </TableCell>
                        <TableCell className="font-mono">{resources(d.content.cost)}</TableCell>
                        <TableCell>{formatDateTime(new Date(d.createdAt))}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1.5">
                            {mine(d) && ownActions(d)}
                            {canDecide(view.me.role, mine(d)) && (
                              <div className="flex flex-wrap gap-1.5">
                                <Button
                                  size="sm"
                                  disabled={busy}
                                  onClick={() => void run(() => demandes.decide(d.id, "validated"))}
                                >
                                  Valider
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={busy}
                                  onClick={() => void run(() => demandes.decide(d.id, "refused"))}
                                >
                                  Refuser
                                </Button>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Un Admin ou un Délégué valide une Demande, jamais la sienne. Le coût vient de la table des coûts
              d&apos;Optizzz, sauf quand le demandeur l&apos;a saisi. Elles sont classées par Priorité, comme les
              validées.
            </p>
          </Panel>

          <Panel title={`Validées (${String(groups.active.length)})`}>
            {groups.active.length === 0 ? (
              <p className="text-muted-foreground">Aucune Demande validée en cours.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Demandeur</TableHead>
                      <TableHead>Priorité</TableHead>
                      <TableHead>Demande</TableHead>
                      <TableHead className="text-right">Reste à envoyer</TableHead>
                      <TableHead className="text-right">Envoyé</TableHead>
                      <TableHead>État</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groups.active.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell className="font-semibold">{d.requester}</TableCell>
                        <TableCell className="min-w-44 whitespace-normal">
                          <PrioriteCell priorite={priorites?.get(d.playerId)} />
                        </TableCell>
                        <TableCell>{d.label}</TableCell>
                        <TableCell className="text-right font-mono whitespace-normal">
                          {resources(d.progress.remaining)}
                          <span className="block text-xs text-muted-foreground">
                            reçu ou en route : {resources(plus(d.progress.received, d.progress.onWay))} sur{" "}
                            {resources(d.content.cost)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Progress
                            part={total(plus(d.progress.received, d.progress.onWay))}
                            whole={total(d.content.cost)}
                          />
                        </TableCell>
                        <TableCell className={d.status === "covered" ? "text-muted-foreground" : "font-medium"}>
                          {STATUS_LABEL[d.status]}
                        </TableCell>
                        <TableCell>
                          {mine(d) ? (
                            ownActions(d)
                          ) : d.status === "validated" && origin ? (
                            <a
                              href={demandeConvoyLink(origin, d.id)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={buttonVariants({ variant: "outline", size: "sm" })}
                            >
                              Envoyer un convoi
                            </a>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            <PrioriteNote />
            <p className="text-xs text-muted-foreground">
              «&nbsp;Envoyer un convoi&nbsp;» ouvre la page Commerce du jeu, que l&apos;extension Optizzz remplit avec
              le destinataire et le reste à envoyer&nbsp;: vérifiez, puis cliquez vous-même «&nbsp;Lancer le
              convoi&nbsp;». Ce convoi compte alors pour la Demande, si vous envoyez vos Convois ; un convoi lancé
              autrement ne compte que dans le Solde. Une Demande est couverte quand les convois reçus et en route
              atteignent son coût, et close quand l&apos;extension du demandeur voit le niveau atteint ou le chantier
              lancé.
            </p>
          </Panel>

          {groups.finished.length > 0 && (
            <Panel title="Terminées (90 derniers jours)">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Demandeur</TableHead>
                      <TableHead>Demande</TableHead>
                      <TableHead>État</TableHead>
                      <TableHead>Le</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groups.finished.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell className="font-semibold">{d.requester}</TableCell>
                        <TableCell>{d.label}</TableCell>
                        <TableCell>
                          {STATUS_LABEL[d.status]}
                          {d.stored === "refused" && d.decidedByPseudo ? ` par ${d.decidedByPseudo}` : ""}
                        </TableCell>
                        <TableCell>{d.endedAt ? formatDateTime(new Date(d.endedAt)) : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Panel>
          )}
        </div>
        <div className="min-w-0 space-y-6">
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

const nameOf = (key: LevelKey) => [...BUILDINGS, ...RESEARCH].find((entry) => entry.key === key)?.name ?? key;

/** The building or research, the levels, and the cost from the table, which the player may type over. */
function DemandeForm({
  busy,
  onMake,
}: {
  busy: boolean;
  onMake: (content: {
    key: LevelKey;
    from: number;
    level: number;
    cost: Resources;
    typed: boolean;
  }) => Promise<boolean>;
}) {
  const ids = { element: useId(), from: useId(), to: useId(), food: useId(), materials: useId() };
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
    if (!(await onMake({ key, ...aim, cost, typed: typed !== null }))) return;
    setLevel(null);
    setFrom(null);
    setTyped(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4">
        <div className="space-y-1">
          <label htmlFor={ids.element} className="block">
            Bâtiment ou recherche
          </label>
          <select
            id={ids.element}
            value={key}
            onChange={(event) => {
              setKey(event.target.value as LevelKey);
              setTyped(null);
            }}
            className="block h-8 w-full max-w-80 rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30"
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
        <div className="space-y-1">
          <label htmlFor={ids.to} className="block">
            Niveau visé
          </label>
          <NumberField
            id={ids.to}
            className="w-24"
            value={level}
            rules={{ ...LEVEL_RULES, min: 1 }}
            onCommit={(value) => {
              setLevel(value);
              setTyped(null);
            }}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor={ids.from} className="block">
            Niveau actuel
          </label>
          <NumberField
            id={ids.from}
            className="w-24"
            placeholder={level !== null ? String(Math.max(0, level - 1)) : ""}
            value={from}
            rules={LEVEL_RULES}
            onCommit={(value) => {
              setFrom(value);
              setTyped(null);
            }}
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-4">
        <div className="space-y-1">
          <label htmlFor={ids.food} className="block">
            Nourriture
          </label>
          <NumberField
            id={ids.food}
            className="w-36"
            value={cost?.food ?? null}
            rules={AMOUNT_RULES}
            onCommit={(value) => setTyped({ food: value ?? 0, materials: cost?.materials ?? 0 })}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor={ids.materials} className="block">
            Matériaux
          </label>
          <NumberField
            id={ids.materials}
            className="w-36"
            value={cost?.materials ?? null}
            rules={AMOUNT_RULES}
            onCommit={(value) => setTyped({ food: cost?.food ?? 0, materials: value ?? 0 })}
          />
        </div>
      </div>
      <p className="text-muted-foreground">
        {!aimed
          ? "Choisissez un niveau visé au-dessus du niveau actuel."
          : typed
            ? "Coût saisi par vous : il sera montré comme tel aux validateurs."
            : `Coût de ${nameOf(key)} d'après la table des coûts d'Optizzz : modifiez-le si besoin.`}{" "}
        Seuls la nourriture et les matériaux se demandent&nbsp;: un convoi ne porte pas d&apos;ouvrières.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={busy || !aim || !cost || cost.food + cost.materials === 0} onClick={() => void make()}>
          Faire la Demande
        </Button>
        {typed && (
          <Button variant="outline" disabled={busy} onClick={() => setTyped(null)}>
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
