// The « Modèles de ponte » box on Reine.php. See docs/features/laying-templates.md.
import { useMemo, useState } from "react";
import type { Place } from "@/game/army/battle";
import { unitLabel, UNITS } from "@/game/army/units";
import { formatNumber } from "@/utils/number-format";
import { NumberField } from "@/utils/NumberField";
import { formatDuration, formatEndTime } from "@/utils/time-format";
import { useStoredSettings } from "@/utils/useStoredSettings";
import { clockValue, parseClock } from "@/features/laying-planner/settings";
import { launchLayings, type LaunchStatus, type LayingOrder } from "./launch";
import { readTemplates, writeTemplates, type SavedTemplate, type StoredTemplates } from "./storage";
import { planTemplate, WORKER, type PlanContext, type Target, type TemplateLine, type TemplatePlan } from "./template";

interface Props {
  origin: string;
  host: string;
  /** Null when the income could not be read: no plan, only the templates. */
  context: PlanContext | null;
  /** The laying queue, for « Créer depuis la file en cours ». */
  queue: readonly TemplateLine[];
  reload: () => void;
}

const PLACES: { value: Place; label: string }[] = [
  { value: "field", label: "Terrain" },
  { value: "nest", label: "Dôme" },
  { value: "lodge", label: "Loge" },
];

const UNIT_CHOICES = [{ key: WORKER, name: "Ouvrière" }, ...UNITS.map((unit) => ({ key: unit.key, name: unit.name }))];
const unitName = (key: string) => UNIT_CHOICES.find((choice) => choice.key === key)?.name ?? key;
/**
 * A laying's length. Beyond a day `formatDuration` rounds up to the hour: cut to the minute first, so that 24 h and a
 * few seconds is not « 1 j 1 h ».
 */
const layingDuration = (ms: number) => formatDuration(ms >= 86_400_000 ? Math.floor(ms / 60_000) * 60_000 : ms);
/** « 100 JSN », « 2 000 ouvrières »: abbreviations as the game writes them. */
const countLabel = (count: number, key: string) =>
  `${formatNumber(count)} ${key === WORKER ? (count > 1 ? "ouvrières" : "ouvrière") : unitLabel(key)}`;

type TargetKind = "fixed" | Target["kind"];
const TARGETS: { kind: TargetKind; label: string }[] = [
  { kind: "fixed", label: "Quantités fixes" },
  { kind: "duration", label: "Sur une durée" },
  { kind: "until", label: "Jusqu'à une heure" },
  { kind: "food", label: "Ce que la nourriture paie" },
];

function defaultTarget(kind: TargetKind): Target | null {
  if (kind === "duration") return { kind, hours: 24 };
  if (kind === "until") return { kind, clock: { hours: 8, minutes: 0 } };
  if (kind === "food") return { kind };
  return null;
}

/** `crypto.randomUUID` exists only on secure pages, and some servers are still served over http. */
const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const newLine = (): TemplateLine => ({ unit: "JSN", destination: "lodge", amount: 100 });

const newTemplate = (name: string, lines: TemplateLine[]): SavedTemplate => ({
  id: newId(),
  name,
  lines,
  target: null,
  rotations: 1,
});

/** The plan with its lines reduced to what the food pays now (same factor for all, same rotations). */
function reducedToFood(plan: TemplatePlan, rotations: number, context: PlanContext): TemplatePlan {
  return planTemplate(
    { lines: plan.lines.map((line) => ({ ...line, amount: line.count })), target: { kind: "food" }, rotations },
    context,
  );
}

function payableText(plan: TemplatePlan, now: Date): string {
  const { affordability } = plan;
  switch (affordability.kind) {
    case "now":
      return "maintenant";
    case "at":
      return `dans ${formatDuration(affordability.at.getTime() - now.getTime())}`;
    case "warehouse":
      return "entrepôt trop petit";
    default:
      return "jamais";
  }
}

const unitsOf = (plan: TemplatePlan) => plan.lines.reduce((sum, line) => sum + line.count, 0);
const layingCount = (plan: TemplatePlan) => plan.layings.length;

function launchLabel(plan: TemplatePlan): string {
  const count = layingCount(plan);
  return `Lancer ${String(count)} ponte${count > 1 ? "s" : ""} : ${formatNumber(unitsOf(plan))} unités, ${layingDuration(plan.duration)}, ${formatNumber(plan.food)} de nourriture`;
}

/** Why a template cannot be launched, in words; null when it can. */
function blocker(plan: TemplatePlan, now: Date): string | null {
  const locked = plan.lines.filter((line) => line.locked);
  if (locked.length > 0) return `Pas encore débloquée : ${locked.map((line) => unitName(line.unit)).join(", ")}.`;
  if (layingCount(plan) === 0) return "Rien à pondre.";
  if (plan.affordability.kind !== "now") return `Pas assez de nourriture : payable ${payableText(plan, now)}.`;
  return null;
}

interface Launch {
  templateId: string;
  orders: LayingOrder[];
  statuses: LaunchStatus[];
  running: boolean;
}

const STATUS_TEXT: Record<LaunchStatus, string> = {
  pending: "en attente",
  launching: "lancement…",
  launched: "lancée",
  failed: "échec",
};

export function LayingTemplates({ origin, host, context, queue, reload }: Props) {
  const [stored, update] = useStoredSettings<StoredTemplates>(host, readTemplates, writeTemplates);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reduced, setReduced] = useState(false);
  const [launch, setLaunch] = useState<Launch | null>(null);
  const now = new Date();

  const plans = useMemo(
    () =>
      new Map(
        (stored?.templates ?? []).map((template) => [template.id, context ? planTemplate(template, context) : null]),
      ),
    [stored, context],
  );

  if (!stored) return null;
  const selected = stored.templates.find((template) => template.id === selectedId) ?? stored.templates[0] ?? null;
  const basePlan = selected ? (plans.get(selected.id) ?? null) : null;
  const plan =
    basePlan && context && reduced && selected ? reducedToFood(basePlan, selected.rotations, context) : basePlan;

  const setTemplates = (change: (templates: SavedTemplate[]) => SavedTemplate[]) => {
    update((current) => ({ ...current, templates: change(current.templates) }));
  };
  const editSelected = (change: (template: SavedTemplate) => SavedTemplate) => {
    if (!selected) return;
    setReduced(false);
    setTemplates((templates) =>
      templates.map((template) => (template.id === selected.id ? change(template) : template)),
    );
  };
  const editLine = (index: number, change: (line: TemplateLine) => TemplateLine) => {
    editSelected((template) => ({
      ...template,
      lines: template.lines.map((line, i) => (i === index ? change(line) : line)),
    }));
  };
  const moveLine = (index: number, by: number) => {
    editSelected((template) => {
      const lines = [...template.lines];
      const [line] = lines.splice(index, 1);
      if (line) lines.splice(index + by, 0, line);
      return { ...template, lines };
    });
  };
  const add = (template: SavedTemplate) => {
    setTemplates((templates) => [...templates, template]);
    setSelectedId(template.id);
    setReduced(false);
    update((current) => ({ ...current, open: true }));
  };

  const start = async (templateId: string, orders: LayingOrder[]) => {
    const statuses = orders.map((): LaunchStatus => "pending");
    setLaunch({ templateId, orders, statuses, running: true });
    const result = await launchLayings(origin, orders, {
      onStatus: (all) => {
        setLaunch({ templateId, orders, statuses: [...all], running: true });
      },
    });
    setLaunch({ templateId, orders, statuses: result, running: false });
    if (result.every((status) => status === "launched")) reload();
  };
  const launchPlan = (templateId: string, launched: TemplatePlan) => {
    const orders = launched.layings.map((laying) => ({
      unit: laying.unit,
      count: laying.count,
      destination: laying.destination,
    }));
    void start(templateId, orders);
  };
  const relaunchRest = () => {
    if (!launch) return;
    const rest = launch.orders.filter((_, i) => launch.statuses[i] !== "launched");
    void start(launch.templateId, rest);
  };
  // Once something left, the page's stock and queue are stale: no new launch until it is reloaded.
  const launched = launch?.statuses.some((status) => status === "launched") ?? false;
  const busy = (launch?.running ?? false) || launched;

  return (
    <section className="optizzz-panel laying-templates" aria-label="Modèles de ponte">
      <button
        type="button"
        className="toggle"
        aria-expanded={stored.open}
        onClick={() => {
          update((current) => ({ ...current, open: !current.open }));
        }}
      >
        <span className="optizzz-panel-title title">Modèles de ponte</span>
        <span className="optizzz-note">
          {stored.templates.length === 0
            ? "aucun modèle"
            : `${String(stored.templates.length)} modèle${stored.templates.length > 1 ? "s" : ""}`}
        </span>
      </button>

      {!context && (
        <p className="optizzz-callout optizzz-callout--warning">
          Prévisions indisponibles : la page Ressources n'a pas pu être lue. Les modèles ne peuvent pas être lancés.
        </p>
      )}

      {stored.templates.length > 0 && (
        <TemplateList
          templates={stored.templates}
          plans={plans}
          selectedId={selected?.id ?? null}
          now={now}
          busy={busy}
          onSelect={(id) => {
            setSelectedId(id);
            setReduced(false);
            update((current) => ({ ...current, open: true }));
          }}
          onLaunch={launchPlan}
        />
      )}

      {launch && <LaunchState launch={launch} onRelaunch={relaunchRest} onReload={reload} />}

      {stored.open && (
        <>
          <div className="optizzz-toolbar">
            <button
              type="button"
              onClick={() => {
                add(newTemplate(`Modèle ${String(stored.templates.length + 1)}`, [newLine()]));
              }}
            >
              Nouveau modèle
            </button>
            <button
              type="button"
              disabled={queue.length === 0}
              title={
                queue.length === 0 ? "Aucune ponte en cours." : "Les pontes de la file deviennent les lignes du modèle."
              }
              onClick={() => {
                add(newTemplate("File en cours", [...queue]));
              }}
            >
              Créer depuis la file en cours
            </button>
            {selected && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    add({ ...selected, id: newId(), name: `${selected.name} (copie)` });
                  }}
                >
                  Dupliquer
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!confirm(`Supprimer le modèle « ${selected.name} » ?`)) return;
                    setTemplates((templates) => templates.filter((template) => template.id !== selected.id));
                    setSelectedId(null);
                  }}
                >
                  Supprimer
                </button>
              </>
            )}
          </div>

          {stored.templates.length === 0 && (
            <p className="optizzz-note">
              Un modèle mémorise une ponte d'armée, par exemple 100 JSN, 50 JS et 10 artilleuses, pour la lancer en un
              clic. Créez-en un, ou partez des pontes de votre file en cours.
            </p>
          )}

          {selected && (
            <TemplateEditor
              template={selected}
              plan={plan}
              context={context}
              now={now}
              onChange={editSelected}
              onEditLine={editLine}
              onMoveLine={moveLine}
            />
          )}

          {selected && plan && context && (
            <TemplateSummary
              plan={plan}
              now={now}
              reduced={reduced}
              busy={busy}
              onReduce={setReduced}
              onLaunch={() => {
                launchPlan(selected.id, plan);
              }}
            />
          )}
        </>
      )}
    </section>
  );
}

function TemplateList(props: {
  templates: readonly SavedTemplate[];
  plans: ReadonlyMap<string, TemplatePlan | null>;
  selectedId: string | null;
  now: Date;
  busy: boolean;
  onSelect: (id: string) => void;
  onLaunch: (id: string, plan: TemplatePlan) => void;
}) {
  return (
    <table className="optizzz-table optizzz-table--dense list">
      <thead>
        <tr>
          <th>Modèle</th>
          <th>Unités</th>
          <th className="optizzz-num">Durée</th>
          <th>Fin</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {props.templates.map((template) => {
          const plan = props.plans.get(template.id) ?? null;
          const reason = plan ? blocker(plan, props.now) : "Prévisions indisponibles.";
          return (
            <tr key={template.id} aria-current={template.id === props.selectedId ? "true" : undefined}>
              <td>
                <button
                  type="button"
                  className="optizzz-button-link"
                  onClick={() => {
                    props.onSelect(template.id);
                  }}
                >
                  {template.name}
                </button>
              </td>
              <td>
                {plan
                  ? plan.lines
                      .filter((line) => line.count > 0)
                      .map((line) => countLabel(line.count, line.unit))
                      .join(", ")
                  : "—"}
              </td>
              <td className="optizzz-num">{plan ? layingDuration(plan.duration) : "—"}</td>
              <td>
                {plan?.lines.at(-1)?.endsAt ? formatEndTime(plan.lines.at(-1)?.endsAt ?? props.now, props.now) : "—"}
              </td>
              <td>
                <button
                  type="button"
                  disabled={!plan || reason !== null || props.busy}
                  title={reason ?? (plan ? launchLabel(plan) : undefined)}
                  aria-label={plan && !reason ? launchLabel(plan) : `Lancer ${template.name}`}
                  onClick={() => {
                    if (plan) props.onLaunch(template.id, plan);
                  }}
                >
                  Lancer
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function TemplateEditor(props: {
  template: SavedTemplate;
  plan: TemplatePlan | null;
  context: PlanContext | null;
  now: Date;
  onChange: (change: (template: SavedTemplate) => SavedTemplate) => void;
  onEditLine: (index: number, change: (line: TemplateLine) => TemplateLine) => void;
  onMoveLine: (index: number, by: number) => void;
}) {
  const { template, plan, now, onChange, onEditLine, onMoveLine } = props;
  const kind: TargetKind = template.target?.kind ?? "fixed";
  const shares = template.target !== null;
  const amountLabel = shares ? "Part" : template.rotations > 1 ? "Par rotation" : "Quantité";
  // The total laid differs from what is typed: shares scaled, or a rotation repeated.
  const showTotal = shares || template.rotations > 1;
  const { target } = template;
  return (
    <div className="optizzz-well editor">
      <div className="optizzz-toolbar">
        <label>
          Nom{" "}
          <input
            type="text"
            value={template.name}
            onChange={(event) => {
              const name = event.target.value;
              onChange((current) => ({ ...current, name }));
            }}
          />
        </label>
      </div>
      <div className="optizzz-toolbar">
        <div className="optizzz-segmented" role="group" aria-label="Les nombres sont">
          {TARGETS.map((choice) => (
            <button
              key={choice.kind}
              type="button"
              aria-pressed={kind === choice.kind}
              onClick={() => {
                onChange((current) => ({ ...current, target: defaultTarget(choice.kind) }));
              }}
            >
              {choice.label}
            </button>
          ))}
        </div>
        {target?.kind === "duration" && (
          <label>
            Durée de ponte{" "}
            <NumberField
              className="hours"
              value={target.hours}
              min={1}
              integer
              onCommit={(hours) => {
                if (hours) onChange((current) => ({ ...current, target: { kind: "duration", hours } }));
              }}
            />{" "}
            h
          </label>
        )}
        {target?.kind === "until" && (
          <label>
            Fin à{" "}
            <input
              type="time"
              value={clockValue(target.clock)}
              onChange={(event) => {
                const clock = parseClock(event.target.value);
                if (clock) onChange((current) => ({ ...current, target: { kind: "until", clock } }));
              }}
            />{" "}
            (après la file en cours)
          </label>
        )}
        <label title="Les lignes se relaient dans la file : avec 10, les unités sortent mélangées tout au long de la ponte au lieu de l'une après l'autre.">
          Rotations{" "}
          <NumberField
            className="rotations"
            value={template.rotations}
            min={1}
            max={100}
            integer
            onCommit={(rotations) => {
              if (rotations) onChange((current) => ({ ...current, rotations }));
            }}
          />
        </label>
      </div>
      {template.rotations > 1 && (
        <p className="optizzz-note">
          {shares
            ? `La répartition est faite ${String(template.rotations)} fois, l'une après l'autre : les unités alternent dans la file.`
            : `Les quantités sont celles d'une rotation, pondue ${String(template.rotations)} fois : les unités alternent dans la file.`}{" "}
          {plan ? `${formatNumber(plan.layings.length)} pontes en tout.` : ""}
        </p>
      )}
      {shares && (
        <p className="optizzz-note">
          Les nombres sont une répartition : chaque ligne garde sa part, arrondie à l'unité. Pour « 10 JSN pour 5 JS »,
          écrivez 10 et 5.
        </p>
      )}
      <div className="optizzz-scroll">
        <table className="optizzz-table optizzz-table--dense lines">
          <thead>
            <tr>
              <th>Unité</th>
              <th>Destination</th>
              <th className="optizzz-num">{amountLabel}</th>
              {showTotal && <th className="optizzz-num">Pondues</th>}
              <th className="optizzz-num">Durée</th>
              <th>Fin</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {template.lines.map((line, i) => {
              const planned = plan?.lines[i];
              return (
                <tr key={i}>
                  <td>
                    <select
                      aria-label="Unité"
                      value={line.unit}
                      onChange={(event) => {
                        const unit = event.target.value;
                        onEditLine(i, (current) => ({ ...current, unit }));
                      }}
                    >
                      {UNIT_CHOICES.map((choice) => (
                        <option key={choice.key} value={choice.key}>
                          {choice.name}
                          {choice.key !== WORKER && props.context && !props.context.layable.includes(choice.key)
                            ? " (verrouillée)"
                            : ""}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    {line.unit === WORKER ? (
                      <span className="optizzz-muted">—</span>
                    ) : (
                      <select
                        aria-label="Destination"
                        value={line.destination}
                        onChange={(event) => {
                          const destination = event.target.value as Place;
                          onEditLine(i, (current) => ({ ...current, destination }));
                        }}
                      >
                        {PLACES.map((place) => (
                          <option key={place.value} value={place.value}>
                            {place.label}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="optizzz-num">
                    <NumberField
                      className="amount"
                      aria-label={amountLabel}
                      value={line.amount}
                      min={0}
                      integer
                      amount
                      onCommit={(amount) => {
                        onEditLine(i, (current) => ({ ...current, amount: amount ?? 0 }));
                      }}
                    />
                  </td>
                  {showTotal && <td className="optizzz-num">{planned ? formatNumber(planned.count) : "—"}</td>}
                  <td className="optizzz-num">
                    {planned ? layingDuration(planned.duration) : "—"}
                    {planned?.tooLong && (
                      <>
                        {" "}
                        <strong
                          className="optizzz-text-warning"
                          title="Plus de 7 jours : le jeu pourrait refuser cette ponte."
                        >
                          ⚠ plus de 7 j
                        </strong>
                      </>
                    )}
                  </td>
                  <td>
                    {planned?.locked ? (
                      <strong className="optizzz-text-danger">verrouillée</strong>
                    ) : planned?.endsAt ? (
                      formatEndTime(planned.endsAt, now)
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="actions">
                    <button
                      type="button"
                      aria-label="Monter la ligne"
                      disabled={i === 0}
                      onClick={() => {
                        onMoveLine(i, -1);
                      }}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      aria-label="Descendre la ligne"
                      disabled={i === template.lines.length - 1}
                      onClick={() => {
                        onMoveLine(i, 1);
                      }}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      aria-label="Retirer la ligne"
                      onClick={() => {
                        onChange((current) => ({ ...current, lines: current.lines.filter((_, j) => j !== i) }));
                      }}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="optizzz-toolbar">
        <button
          type="button"
          onClick={() => {
            onChange((current) => ({ ...current, lines: [...current.lines, newLine()] }));
          }}
        >
          Ajouter une ligne
        </button>
      </div>
    </div>
  );
}

function TemplateSummary(props: {
  plan: TemplatePlan;
  now: Date;
  reduced: boolean;
  busy: boolean;
  onReduce: (reduced: boolean) => void;
  onLaunch: () => void;
}) {
  const { plan, now } = props;
  const end = plan.lines.at(-1)?.endsAt ?? null;
  const reason = blocker(plan, now);
  const payable = payableText(plan, now);
  return (
    <div className="summary">
      <div className="optizzz-stats">
        <div className="optizzz-stat">
          <span className="optizzz-stat-label">Nourriture</span>
          <span className="optizzz-stat-value">{formatNumber(plan.food)}</span>
        </div>
        <div className="optizzz-stat">
          <span className="optizzz-stat-label">Durée</span>
          <span className="optizzz-stat-value">{layingDuration(plan.duration)}</span>
        </div>
        <div className="optizzz-stat">
          <span className="optizzz-stat-label">Fin de ponte</span>
          <span className="optizzz-stat-value">{end ? formatEndTime(end, now) : "—"}</span>
        </div>
        <div className="optizzz-stat">
          <span className="optizzz-stat-label">Payable</span>
          <span
            className={`optizzz-stat-value ${plan.affordability.kind === "now" ? "optizzz-text-success" : plan.affordability.kind === "at" ? "optizzz-text-warning" : "optizzz-text-danger"}`}
          >
            {payable}
          </span>
        </div>
        <div className="optizzz-stat">
          <span className="optizzz-stat-label">Bilan après</span>
          <span className={`optizzz-stat-value ${plan.balanceAfter < 0 ? "optizzz-text-danger" : ""}`}>
            {formatNumber(Math.round(plan.balanceAfter))} / j
          </span>
          <span className="optizzz-stat-note">entretien {formatNumber(Math.round(plan.upkeepPerDay))} / j</span>
        </div>
      </div>
      {plan.lines.some((line) => line.tooLong) && (
        <p className="optizzz-callout optizzz-callout--warning">
          ⚠ Une ponte dure plus de 7 jours, la limite du curseur du jeu : le jeu pourrait la refuser.
        </p>
      )}
      {props.reduced && (
        <p className="optizzz-note">
          Réduit à ce que la nourriture paie maintenant.{" "}
          <button
            type="button"
            className="optizzz-button-link"
            onClick={() => {
              props.onReduce(false);
            }}
          >
            Revenir au modèle
          </button>
        </p>
      )}
      {reason && <p className="optizzz-callout optizzz-callout--danger">{reason}</p>}
      <div className="optizzz-toolbar">
        <button
          type="button"
          className="optizzz-button-primary"
          disabled={reason !== null || props.busy}
          onClick={props.onLaunch}
        >
          {launchLabel(plan)}
        </button>
        {plan.affordability.kind === "at" && !props.reduced && (
          <button
            type="button"
            onClick={() => {
              props.onReduce(true);
            }}
          >
            Réduire à ce que vous pouvez payer
          </button>
        )}
      </div>
    </div>
  );
}

function LaunchState(props: { launch: Launch; onRelaunch: () => void; onReload: () => void }) {
  const { launch } = props;
  const failed = launch.statuses.includes("failed");
  return (
    <div className="optizzz-well launch" aria-live="polite">
      <ol>
        {launch.orders.map((order, i) => {
          const status = launch.statuses[i] ?? "pending";
          return (
            <li key={i}>
              {countLabel(order.count, order.unit)} :{" "}
              <strong
                className={
                  status === "launched"
                    ? "optizzz-text-success"
                    : status === "failed"
                      ? "optizzz-text-danger"
                      : undefined
                }
              >
                {STATUS_TEXT[status]}
              </strong>
            </li>
          );
        })}
      </ol>
      {!launch.running && failed && (
        <div className="optizzz-toolbar">
          <button type="button" onClick={props.onRelaunch}>
            Relancer le reste
          </button>
          <button type="button" className="optizzz-button-link" onClick={props.onReload}>
            Recharger la page
          </button>
        </div>
      )}
    </div>
  );
}
