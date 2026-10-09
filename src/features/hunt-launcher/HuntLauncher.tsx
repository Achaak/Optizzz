import { useEffect, useMemo, useRef, useState } from "react";
import { loadLevels, unknownLevelsHint, type HuntLevels } from "@/data/levels";
import { createEngine } from "./engine/client";
import { summarize, type Objective, type Plan, type PlanInput } from "./engine/planner";
import type { Extras } from "./engine/requests";
import { armyFromKeys, armyToKeys, unitLabel, UNITS } from "@/game/army/units";
import { HuntTable } from "./HuntTable";
import { launchHunts, type LaunchStatus } from "./launch";
import { LossCurve } from "./LossCurve";
import { hasNoArmyToSend, readHuntForm, type HuntForm, type OngoingHunt } from "./pages";
import { huntableArmy, readSettings, writeSettings, type ObjectiveKind, type Settings } from "./settings";
import { stepNotice, unitsText } from "./view";
import { formatDecimal, formatNumber } from "@/utils/number-format";
import { NumberField } from "@/utils/NumberField";
import { useStoredSettings } from "@/utils/useStoredSettings";
import { formatDuration, formatEndTime } from "@/utils/time-format";

interface Props {
  origin: string;
  /** Hunting field now (header). */
  currentField: number;
  ongoing: OngoingHunt[];
  /** When the page was read: the hunts' return times count from it. */
  readAt: Date;
}

const RATIOS = [1, 2, 3, 4, 5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 10];
const OBJECTIVES: { kind: ObjectiveKind; label: string; hint: string }[] = [
  { kind: "yield", label: "Rendement", hint: "plus de cm² en acceptant des pertes" },
  { kind: "ratio", label: "Ratio", hint: "attaque / difficulté, comme le simulateur de Calystene" },
];
const RELOAD_DELAY_MS = 1500;
const RECOMPUTE_DELAY_MS = 300;

/** The hunt form, « none » when the game has no army to send, « error » when the page cannot be read. */
async function fetchHuntForm(origin: string): Promise<HuntForm | "none" | "error"> {
  const response = await fetch(`${origin}/AcquerirTerrain.php`);
  if (!response.ok) return "error";
  const doc = new DOMParser().parseFromString(await response.text(), "text/html");
  return readHuntForm(doc) ?? (hasNoArmyToSend(doc) ? "none" : "error");
}

function objectiveOf(settings: Settings): Objective {
  switch (settings.objective) {
    case "yield":
      return { kind: "yield", maxLossShare: settings.maxLossShare };
    case "ratio":
      return { kind: "ratio", ratio: settings.ratio };
  }
}

export function HuntLauncher({ origin, currentField, ongoing, readAt }: Props) {
  const host = new URL(origin).host;
  const engine = useMemo(() => createEngine(), []);
  const [settings, updateSettings] = useStoredSettings(host, readSettings, writeSettings);
  const [levels, setLevels] = useState<HuntLevels | null>(null);
  const [levelsError, setLevelsError] = useState<string | null>(null);
  const [form, setForm] = useState<HuntForm | "none" | "error" | null>(null);
  const ongoingGain = ongoing.reduce((sum, hunt) => sum + hunt.fieldGain, 0);
  const [field, setField] = useState(currentField + ongoingGain);
  const [answered, setAnswered] = useState<{ input: PlanInput; answer: Plan } | null>(null);
  const [extras, setExtras] = useState<Extras | null>(null);
  const [override, setOverride] = useState<Plan | null>(null);
  const [editing, setEditing] = useState(false);
  const [statuses, setStatuses] = useState<LaunchStatus[]>([]);
  const [busy, setBusy] = useState(false);
  // Once some hunts left, the army and slots read at load are stale: the plan stays as launched.
  const [frozen, setFrozen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const requestId = useRef(0);

  useEffect(() => {
    loadLevels(origin).then(setLevels, (error: unknown) => {
      setLevelsError(unknownLevelsHint(error));
    });
    fetchHuntForm(origin).then(setForm, () => {
      setForm("error");
    });
  }, [origin, host]);

  useEffect(() => () => engine.dispose(), [engine]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const input = useMemo<PlanInput | null>(() => {
    if (!settings || !levels || !form || form === "error" || form === "none") return null;
    return {
      army: armyFromKeys(huntableArmy(form.available, settings.reserve)),
      field,
      fieldAtLaunch: currentField,
      slots: Math.max(0, levels.huntSpeed + 1 - ongoing.length),
      levels,
      objective: objectiveOf(settings),
    };
  }, [settings, levels, form, field, currentField, ongoing.length]);

  // Units away come back with the hunts: known with Compte+ only.
  const waiting = useMemo(() => {
    if (!levels || ongoing.length === 0 || ongoing.some((hunt) => !hunt.troops)) return null;
    const troops = UNITS.map((unit) => ongoing.reduce((sum, hunt) => sum + (hunt.troops?.[unit.key] ?? 0), 0));
    const lastReturn = Math.max(...ongoing.map((hunt) => hunt.returnsAt.getTime()));
    return { troops, waitSeconds: Math.max(0, (lastReturn - readAt.getTime()) / 1000), allSlots: levels.huntSpeed + 1 };
  }, [levels, ongoing, readAt]);

  useEffect(() => {
    if (!input || frozen) return;
    const id = ++requestId.current;
    const timer = setTimeout(() => {
      void engine({ type: "plan", input }).then(async (result) => {
        if (id !== requestId.current) return;
        setAnswered({ input, answer: result });
        setExtras(null);
        setOverride(null);
        setStatuses([]);
        setEditing(false);
        const more = await engine({ type: "extras", input, plan: result, waiting });
        if (id === requestId.current) setExtras(more);
      });
    }, RECOMPUTE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [engine, input, waiting, frozen]);

  const answer = answered?.answer ?? null;
  const computing = editing || (input !== null && !frozen && answered?.input !== input);
  const plan = override ?? answer;

  const pickAmount = (amount: number) => {
    if (!input || !plan || frozen) return;
    const id = ++requestId.current;
    setEditing(true);
    void engine({ type: "fixed", input, count: Math.max(1, plan.hunts.length), amount }).then((result) => {
      if (id !== requestId.current) return;
      setOverride(result);
      setEditing(false);
    });
  };

  const editHunt = (index: number, change: { amount?: number; unit?: string; count?: number }) => {
    if (!input || !plan || frozen) return;
    const drafts = plan.hunts.map((hunt) => ({ amount: hunt.amount, field: hunt.field, army: [...hunt.army] }));
    const edited = drafts[index];
    if (!edited) return;
    if (change.amount !== undefined) edited.amount = change.amount;
    if (change.unit !== undefined && change.count !== undefined) {
      const unit = UNITS.findIndex((candidate) => candidate.key === change.unit);
      edited.army[unit] = change.count;
    }
    // Later hunts fight at the field the edited one leaves.
    let at = input.field;
    for (const draft of drafts) {
      draft.field = at;
      at += draft.amount;
    }
    const id = ++requestId.current;
    setEditing(true);
    void Promise.all(
      drafts.map((draft, i) =>
        i < index && plan.hunts[i] ? Promise.resolve(plan.hunts[i]) : engine({ type: "hunt", input, draft }),
      ),
    ).then((hunts) => {
      if (id !== requestId.current) return;
      setOverride(summarize(hunts));
      setEditing(false);
    });
  };

  const launch = async (from: number, to: number) => {
    if (!plan) return;
    setBusy(true);
    const orders = plan.hunts.slice(from, to).map((hunt) => ({ amount: hunt.amount, army: armyToKeys(hunt.army) }));
    const base = plan.hunts.map((_, i) => statuses[i] ?? "pending");
    const result = await launchHunts(origin, orders, {
      onStatus: (part) => {
        setStatuses(base.map((status, i) => (i >= from && i < to ? (part[i - from] ?? status) : status)));
      },
    });
    const all = base.map((status, i) => (i >= from && i < to ? (result[i - from] ?? status) : status));
    setBusy(false);
    if (all.every((status) => status === "launched")) setTimeout(() => location.reload(), RELOAD_DELAY_MS);
    else if (all.includes("launched")) setFrozen(true);
  };

  if (!settings) return null;
  const header = (
    <button
      type="button"
      className="toggle"
      aria-expanded={settings.open}
      onClick={() => updateSettings((s) => ({ ...s, open: !s.open }))}
    >
      <span className="title">🐜 Lanceur de chasse</span>
      <span className="summary">{summaryText(plan, now, computing)}</span>
    </button>
  );
  if (!settings.open) return <div className="hunt-launcher closed">{header}</div>;

  const ongoingList = ongoing.length > 0 && (
    <div className="ongoing">
      <strong>Chasses en cours</strong>
      <ul>
        {ongoing.map((hunt) => (
          <li key={hunt.id}>
            +{formatNumber(hunt.fieldGain)} cm² · retour dans{" "}
            {formatDuration(Math.max(0, hunt.returnsAt.getTime() - now.getTime()))} (
            {formatEndTime(hunt.returnsAt, now)})
            {hunt.troops && <span className="muted"> · {unitsText(hunt.troops)}</span>}
          </li>
        ))}
      </ul>
    </div>
  );

  if (form === "error" || levelsError) {
    return (
      <div className="hunt-launcher">
        {header}
        <p className="error">
          {levelsError ?? "Impossible de lire le formulaire de chasse (AcquerirTerrain.php)."} Aucune chasse n'est
          calculée.
        </p>
        {ongoingList}
      </div>
    );
  }
  if (form === "none") {
    return (
      <div className="hunt-launcher">
        {header}
        <p className="note">Aucune unité à envoyer : votre armée est en chasse, ou vous n'en avez pas.</p>
        {ongoingList}
      </div>
    );
  }
  if (!form || !levels || !input) {
    return (
      <div className="hunt-launcher">
        {header}
        <p className="note">Lecture de votre armée et de vos niveaux…</p>
      </div>
    );
  }

  const unitKeys = UNITS.filter((unit) => (form.available[unit.key] ?? 0) > 0).map((unit) => unit.key);
  const sent = UNITS.map((_, i) => plan?.hunts.reduce((sum, hunt) => sum + (hunt.army[i] ?? 0), 0) ?? 0);
  const emptiesGarrison =
    unitKeys.length > 0 && unitKeys.every((key) => sent[UNITS.findIndex((u) => u.key === key)] === form.available[key]);
  // A refused hunt can be tried again.
  const toLaunch = (i: number) => (statuses[i] ?? "pending") !== "launched";
  const pendingCount = plan ? plan.hunts.filter((_, i) => toLaunch(i)).length : 0;
  const firstPending = plan ? plan.hunts.findIndex((_, i) => toLaunch(i)) : -1;
  const objective = OBJECTIVES.find((o) => o.kind === settings.objective);

  return (
    <div className="hunt-launcher">
      {header}

      <div className="inputs">
        <fieldset>
          <legend>Objectif</legend>
          {OBJECTIVES.map((o) => (
            <label key={o.kind} title={o.hint}>
              <input
                type="radio"
                name="objective"
                checked={settings.objective === o.kind}
                onChange={() => updateSettings((s) => ({ ...s, objective: o.kind }))}
              />
              {o.label}
            </label>
          ))}
          {settings.objective === "yield" && (
            <label>
              pertes jusqu'à{" "}
              <NumberField
                min={0.1}
                max={20}
                step={0.1}
                value={Math.round(settings.maxLossShare * 1000) / 10}
                onCommit={(percent) => {
                  if (percent !== null) updateSettings((s) => ({ ...s, maxLossShare: percent / 100 }));
                }}
              />{" "}
              % de l'armée envoyée (en nourriture, 9 fois sur 10)
            </label>
          )}
          {settings.objective === "ratio" && (
            <label>
              ratio{" "}
              <select
                value={settings.ratio}
                onChange={(e) => updateSettings((s) => ({ ...s, ratio: Number(e.target.value) }))}
              >
                {RATIOS.map((ratio) => (
                  <option key={ratio} value={ratio}>
                    {formatDecimal(ratio)}
                  </option>
                ))}
              </select>
            </label>
          )}
          <span className="note">{objective?.hint}</span>
        </fieldset>

        <fieldset>
          <legend>Terrain et niveaux</legend>
          <label title="TDC au moment où les chasses combattront : votre TDC plus ce que rapportent les chasses en cours. Changez-le si vous attendez un flood.">
            TDC de calcul{" "}
            <NumberField
              min={1}
              integer
              className="wide"
              value={field}
              onCommit={(value) => {
                if (value !== null) setField(value);
              }}
            />{" "}
            cm²
          </label>
          {field !== currentField + ongoingGain && (
            <button type="button" className="link" onClick={() => setField(currentField + ongoingGain)}>
              revenir à {formatNumber(currentField + ongoingGain)}
            </button>
          )}
          <span className="note">
            Armes {levels.weapons} · Bouclier {levels.shield} · Vitesse de chasse {levels.huntSpeed} · Étable à
            cochenilles {levels.cochineal} · {input.slots} créneau{input.slots > 1 ? "x" : ""} libre
            {input.slots > 1 ? "s" : ""}
          </span>
        </fieldset>

        <fieldset>
          <legend>Réserve (unités gardées à la maison)</legend>
          {unitKeys.length === 0 && <span className="note">Aucune unité disponible.</span>}
          {unitKeys.map((key) => (
            <label key={key} title={UNITS.find((u) => u.key === key)?.name}>
              {unitLabel(key)}{" "}
              <NumberField
                min={0}
                integer
                className="units"
                value={settings.reserve[key] ?? 0}
                onCommit={(count) => {
                  updateSettings((s) => ({ ...s, reserve: { ...s.reserve, [key]: count ?? 0 } }));
                }}
              />
              <span className="muted"> / {formatNumber(form.available[key] ?? 0)}</span>
            </label>
          ))}
        </fieldset>
      </div>

      {input.slots === 0 && <p className="warning">Tous vos créneaux de chasse sont pris.</p>}
      {computing && <p className="note">Calcul…</p>}
      {frozen && (
        <p className="warning">
          Des chasses sont parties : ce plan n'est plus recalculé, l'armée disponible a changé.{" "}
          <button
            type="button"
            className="link"
            onClick={() => {
              location.reload();
            }}
          >
            Recharger la page
          </button>{" "}
          pour en préparer d'autres.
        </p>
      )}

      {answer?.hunts.length === 0 && input.slots > 0 && (
        <p className="warning">Aucune chasse possible avec ces unités et cet objectif.</p>
      )}

      {plan && plan.hunts.length > 0 && (
        <>
          <HuntTable
            plan={plan}
            unitKeys={unitKeys}
            statuses={statuses}
            busy={busy}
            frozen={frozen}
            launchBlocked={computing}
            now={now}
            onEdit={editHunt}
            onLaunch={(i) => void launch(i, i + 1)}
          />
          <div className="actions">
            <button
              type="button"
              className="primary"
              disabled={busy || computing || pendingCount === 0}
              onClick={() => void launch(Math.max(0, firstPending), plan.hunts.length)}
            >
              {pendingCount === plan.hunts.length
                ? `Lancer ${plan.hunts.length === 1 ? "la chasse" : `${String(plan.hunts.length)} chasses`} (${formatNumber(plan.totalAmount)} cm²${emptiesGarrison ? ", toute l'armée" : ""})`
                : `Lancer les ${String(pendingCount)} chasses restantes`}
            </button>
            {override && !frozen && (
              <button type="button" className="link" onClick={() => setOverride(null)}>
                revenir au plan conseillé
              </button>
            )}
          </div>
          <p className="totals">
            +{formatNumber(plan.totalAmount)} cm² · {formatNumber(plan.fieldPerHour * 24)} cm²/jour à ce rythme ·{" "}
            {formatNumber(plan.hunts.reduce((sum, hunt) => sum + hunt.outcome.food, 0))} de nourriture rapportée
          </p>
          {emptiesGarrison && (
            <p className="warning">Ce plan envoie toute votre armée : rien ne reste pour défendre la fourmilière.</p>
          )}
          <p className="note">{stepNotice(field, plan.totalAmount)}</p>

          {extras && extras.curve.length > 1 && !frozen && (
            <LossCurve curve={extras.curve} amount={plan.hunts[0]?.amount ?? 0} onPick={pickAmount} />
          )}
          {override && extras && (
            <p className="note">
              La courbe et les conseils ci-dessous portent sur le plan conseillé, à surfaces égales.
            </p>
          )}

          {answer && extras && extras.laying.length > 0 && (
            <ul className="advice">
              {extras.laying.map((step) => (
                <li key={step.extra}>
                  Avec +{formatNumber(step.extra)} {step.unit} : {huntsText(step.plan)} (
                  {signed(step.plan.totalAmount - answer.totalAmount)} cm²)
                </li>
              ))}
            </ul>
          )}

          {answer && extras?.waiting && waiting && (
            <p className="note">
              En attendant le retour des chasses en cours ({formatDuration(waiting.waitSeconds * 1000)}) :{" "}
              {huntsText(extras.waiting.plan)}, soit {formatNumber(extras.waiting.fieldPerHour)} cm²/h attente comprise,
              contre {formatNumber(answer.fieldPerHour)} cm²/h en lançant maintenant.
            </p>
          )}
        </>
      )}

      {ongoingList}

      <p className="meta">
        Pertes simulées sur 10 000 tirages de proies, une unité blessée à plus de la moitié de sa vie comptant comme
        perdue. Colonne Calystene : tables de pertes du simulateur de chasse de Calystene.
      </p>
    </div>
  );
}

const signed = (value: number) => `${value >= 0 ? "+" : "−"}${formatNumber(Math.abs(value))}`;

function huntsText(plan: Plan): string {
  if (plan.hunts.length === 0) return "aucune chasse";
  const amounts = [...new Set(plan.hunts.map((hunt) => hunt.amount))];
  const size =
    amounts.length === 1 ? `${formatNumber(amounts[0] ?? 0)} cm²` : `${formatNumber(plan.totalAmount)} cm² en tout`;
  return `${String(plan.hunts.length)} chasse${plan.hunts.length > 1 ? "s" : ""} de ${size}`;
}

function summaryText(plan: Plan | null, now: Date, computing: boolean): string {
  if (!plan) return computing ? "calcul…" : "";
  if (plan.hunts.length === 0) return "aucune chasse possible";
  const lost = plan.hunts.reduce((sum, hunt) => sum + hunt.outcome.lostUnits.mean, 0);
  const back = formatEndTime(new Date(now.getTime() + plan.durationSeconds * 1000), now);
  return `${huntsText(plan)} · +${formatNumber(plan.totalAmount)} cm² · retour ${back} · ≈ ${formatNumber(lost)} pertes`;
}
