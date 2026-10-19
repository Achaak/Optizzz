import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { loadLaying } from "@/data/laying";
import { loadLevels, unknownLevelsHint, type HuntLevels } from "@/data/levels";
import { placeProbes } from "@/data/probes";
import { keepProbes, type ProbePlan } from "@/game/probes";
import { createEngine } from "./engine/client";
import type { RatioChoice } from "./engine/extras";
import { summarize, type Objective, type Plan, type PlanInput } from "./engine/planner";
import type { Extras } from "./engine/requests";
import { armyFromKeys, armyToKeys, UNITS } from "@/game/army/units";
import { FieldTable, HuntDetails, huntsText } from "./HuntDetails";
import { HuntParameters } from "./HuntParameters";
import { HuntResult } from "./HuntResult";
import { HuntTable } from "./HuntTable";
import { launchHunts, type LaunchStatus } from "./launch";
import { hasNoArmyToSend, readHuntForm, type HuntForm, type OngoingHunt } from "./pages";
import { PlayerData } from "./PlayerData";
import { SimpleView } from "./SimpleView";
import { DEFAULT_SETTINGS, huntableArmy, readSettings, writeSettings, type SectionKey } from "./settings";
import { unitsText } from "./view";
import { formatAmount, formatNumber } from "@/utils/number-format";
import { Amount } from "@/utils/Amount";
import { useStoredSettings } from "@/utils/useStoredSettings";
import { formatDuration, formatEndTime } from "@/utils/time-format";

interface Props {
  origin: string;
  /** Hunting field now (header). */
  currentField: number;
  ongoing: OngoingHunt[];
  /** When the page was read: the hunts' return times count from it. */
  readAt: Date;
  /** Places that keep a probe (« Sondes »): as many ants stay home, put back there after the launch. */
  probes: ProbePlan;
}

const RELOAD_DELAY_MS = 1500;
const RECOMPUTE_DELAY_MS = 300;

/** The hunt form, « none » when the game has no army to send, « error » when the page cannot be read. */
async function fetchHuntForm(origin: string): Promise<HuntForm | "none" | "error"> {
  const response = await fetch(`${origin}/AcquerirTerrain.php`);
  if (!response.ok) return "error";
  const doc = new DOMParser().parseFromString(await response.text(), "text/html");
  return readHuntForm(doc) ?? (hasNoArmyToSend(doc) ? "none" : "error");
}

export function HuntLauncher({ origin, currentField, ongoing, readAt, probes }: Props) {
  const host = new URL(origin).host;
  const engine = useMemo(() => createEngine(), []);
  const [settings, updateSettings] = useStoredSettings(host, readSettings, writeSettings);
  const [readLevels, setReadLevels] = useState<HuntLevels | null>(null);
  const [levelEdits, setLevelEdits] = useState<Partial<HuntLevels>>({});
  const [levelsError, setLevelsError] = useState<string | null>(null);
  const [layingSpeed, setLayingSpeed] = useState<number | null>(null);
  const [form, setForm] = useState<HuntForm | "none" | "error" | null>(null);
  const ongoingGain = ongoing.reduce((sum, hunt) => sum + hunt.fieldGain, 0);
  const [launchEdit, setLaunchEdit] = useState<number | null>(null);
  const [arrivalEdit, setArrivalEdit] = useState<number | null>(null);
  const launchField = launchEdit ?? currentField;
  const arrivalField = arrivalEdit ?? launchField + ongoingGain;
  const [huntCount, setHuntCount] = useState<number | null>(null);
  const [huntAmount, setHuntAmount] = useState<number | null>(null);
  const [answered, setAnswered] = useState<{ input: PlanInput; answer: Plan } | null>(null);
  const [extras, setExtras] = useState<Extras | null>(null);
  const [ratioChoices, setRatioChoices] = useState<RatioChoice[] | null>(null);
  const [override, setOverride] = useState<Plan | null>(null);
  const [editing, setEditing] = useState(false);
  const [statuses, setStatuses] = useState<LaunchStatus[]>([]);
  const [busy, setBusy] = useState(false);
  // Once some hunts left, the army and slots read at load are stale: the plan stays as launched.
  const [frozen, setFrozen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const requestId = useRef(0);
  const ratiosId = useRef(0);

  useEffect(() => {
    loadLevels(origin).then(setReadLevels, (error: unknown) => {
      setLevelsError(unknownLevelsHint(error));
    });
    loadLaying(origin, new Date()).then(
      (laying) => {
        setLayingSpeed(laying?.speed ?? null);
      },
      () => {
        setLayingSpeed(null);
      },
    );
    fetchHuntForm(origin).then(setForm, () => {
      setForm("error");
    });
  }, [origin, host]);

  useEffect(() => () => engine.dispose(), [engine]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // A level the player typed replaces the one read.
  const levels = useMemo<HuntLevels | null>(
    () =>
      readLevels && {
        weapons: levelEdits.weapons ?? readLevels.weapons,
        shield: levelEdits.shield ?? readLevels.shield,
        huntSpeed: levelEdits.huntSpeed ?? readLevels.huntSpeed,
        cochineal: levelEdits.cochineal ?? readLevels.cochineal,
      },
    [readLevels, levelEdits],
  );
  const slots = levels ? Math.max(0, levels.huntSpeed + 1 - ongoing.length) : 0;

  // Only what the plan depends on: folding a part or showing a column must not compute it again.
  const reserve = settings?.reserve;
  const objectiveKind = settings?.objective;
  const ratio = settings?.ratio;
  const maxLossShare = settings?.maxLossShare;
  const dispatch = settings?.dispatch;

  // Everything but the objective and the surface: what the ratio list is computed from.
  const base = useMemo(() => {
    if (!reserve || !levels || !form || form === "error" || form === "none") return null;
    return {
      army: keepProbes(armyFromKeys(huntableArmy(form.available, reserve)), armyFromKeys(form.available), probes),
      field: arrivalField,
      fieldAtLaunch: launchField,
      slots,
      levels,
      ...(huntCount === null ? {} : { huntCount: Math.min(huntCount, Math.max(1, slots)) }),
    };
  }, [reserve, levels, form, arrivalField, launchField, slots, huntCount, probes]);

  const input = useMemo<PlanInput | null>(() => {
    if (!base || objectiveKind === undefined || ratio === undefined || maxLossShare === undefined) return null;
    const objective: Objective = objectiveKind === "ratio" ? { kind: "ratio", ratio } : { kind: "yield", maxLossShare };
    return { ...base, objective, dispatch, ...(huntAmount === null ? {} : { huntAmount }) };
  }, [base, objectiveKind, ratio, maxLossShare, dispatch, huntAmount]);

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

  useEffect(() => {
    if (!base || frozen) return;
    const id = ++ratiosId.current;
    const timer = setTimeout(() => {
      setRatioChoices(null);
      // Each ratio of the list sets its own objective.
      void engine({ type: "ratios", input: { ...base, objective: { kind: "ratio", ratio: 1 } } }).then((choices) => {
        if (id === ratiosId.current) setRatioChoices(choices);
      });
    }, RECOMPUTE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [engine, base, frozen]);

  const answer = answered?.answer ?? null;
  const computing = editing || (input !== null && !frozen && answered?.input !== input);
  const plan = override ?? answer;

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
    const initial = plan.hunts.map((_, i) => statuses[i] ?? "pending");
    const result = await launchHunts(origin, orders, {
      onStatus: (part) => {
        setStatuses(initial.map((status, i) => (i >= from && i < to ? (part[i - from] ?? status) : status)));
      },
    });
    const all = initial.map((status, i) => (i >= from && i < to ? (result[i - from] ?? status) : status));
    // The game does not say which places the hunters leave: the probes kept home are put back on their places.
    if (Object.keys(probes).length > 0 && result.includes("launched")) {
      await placeProbes(origin, probes).catch((error: unknown) => {
        console.warn("[Optizzz] hunt launcher: probes not put back", error);
      });
    }
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
      <span className="title optizzz-panel-title">🐜 Lanceur de chasse</span>
      <span className="summary">{summaryText(plan, now, computing)}</span>
    </button>
  );
  if (!settings.open) return <div className="hunt-launcher optizzz-panel closed">{header}</div>;

  const section = (key: SectionKey, title: string, content: ReactNode, aside?: string) => (
    <details
      className="optizzz-disclosure section"
      open={settings.sections[key]}
      onToggle={(e) => {
        const open = e.currentTarget.open;
        if (open !== settings.sections[key]) {
          updateSettings((s) => ({ ...s, sections: { ...s.sections, [key]: open } }));
        }
      }}
    >
      <summary>
        {title}
        {aside && <span className="aside optizzz-muted">{aside}</span>}
      </summary>
      {content}
    </details>
  );

  const ongoingList = ongoing.length > 0 && (
    <div className="ongoing">
      <strong>Chasses en cours</strong>
      <ul>
        {ongoing.map((hunt) => (
          <li key={hunt.id}>
            +<Amount value={hunt.fieldGain} /> cm² · retour dans{" "}
            {formatDuration(Math.max(0, hunt.returnsAt.getTime() - now.getTime()))} (
            {formatEndTime(hunt.returnsAt, now)})
            {hunt.troops && <span className="optizzz-muted"> · {unitsText(hunt.troops)}</span>}
          </li>
        ))}
      </ul>
    </div>
  );

  if (form === "error" || levelsError) {
    return (
      <div className="hunt-launcher optizzz-panel">
        {header}
        <p className="optizzz-callout optizzz-callout--danger">
          {levelsError ?? "Impossible de lire le formulaire de chasse (AcquerirTerrain.php)."} Aucune chasse n'est
          calculée.
        </p>
        {ongoingList}
      </div>
    );
  }
  if (form === "none") {
    return (
      <div className="hunt-launcher optizzz-panel">
        {header}
        <p className="optizzz-note">Aucune unité à envoyer : votre armée est en chasse, ou vous n'en avez pas.</p>
        {ongoingList}
      </div>
    );
  }
  if (!form || !levels || !readLevels || !input) {
    return (
      <div className="hunt-launcher optizzz-panel">
        {header}
        <p className="optizzz-note">Lecture de votre armée et de vos niveaux…</p>
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
  const hasPlan = plan !== null && plan.hunts.length > 0;
  // Changing what the plan is computed from drops the hunts changed by hand.
  const reset = () => setOverride(null);

  const launchArea = hasPlan && (
    <>
      <HuntTable
        plan={plan}
        unitKeys={unitKeys}
        columns={settings.advanced ? settings.columns : DEFAULT_SETTINGS.columns}
        options={settings.advanced}
        onColumn={(column, shown) => {
          updateSettings((s) => ({ ...s, columns: { ...s.columns, [column]: shown } }));
        }}
        statuses={statuses}
        busy={busy}
        frozen={frozen}
        launchBlocked={computing}
        now={now}
        onEdit={editHunt}
        onLaunch={(i) => void launch(i, i + 1)}
      />
      {emptiesGarrison && (
        <p className="optizzz-callout optizzz-callout--warning">
          Ce plan envoie toute votre armée : rien ne reste pour défendre la fourmilière.
        </p>
      )}
      <div className="actions optizzz-toolbar">
        <button
          type="button"
          className="optizzz-button-primary"
          disabled={busy || computing || pendingCount === 0}
          onClick={() => void launch(Math.max(0, firstPending), plan.hunts.length)}
        >
          {pendingCount === plan.hunts.length
            ? `Lancer ${plan.hunts.length === 1 ? "la chasse" : `les ${String(plan.hunts.length)} chasses`} (${formatAmount(plan.totalAmount)} cm²${emptiesGarrison ? ", toute l'armée" : ""})`
            : `Lancer les ${String(pendingCount)} chasses restantes`}
        </button>
        {override && !frozen && (
          <button type="button" className="optizzz-button-link" onClick={reset}>
            revenir au plan calculé
          </button>
        )}
      </div>
      <p className={busy ? "optizzz-callout optizzz-callout--warning" : "optizzz-note"}>
        Ne quittez pas cette page tant que toutes les chasses ne sont pas lancées.
      </p>
    </>
  );

  const notices = (
    <>
      {slots === 0 && (
        <p className="optizzz-callout optizzz-callout--warning">Tous vos créneaux de chasse sont pris.</p>
      )}
      {computing && <p className="optizzz-note">Calcul…</p>}
      {frozen && (
        <p className="optizzz-callout optizzz-callout--warning">
          Des chasses sont parties : ce plan n'est plus recalculé, l'armée disponible a changé.{" "}
          <button
            type="button"
            className="optizzz-button-link"
            onClick={() => {
              location.reload();
            }}
          >
            Recharger la page
          </button>{" "}
          pour en préparer d'autres.
        </p>
      )}
      {answer?.hunts.length === 0 && slots > 0 && (
        <p className="optizzz-callout optizzz-callout--warning">
          Aucune chasse possible avec ces unités et ce réglage
          {settings.advanced ? "." : " : essayez « Prudent » ou « Rapide »."}
        </p>
      )}
    </>
  );

  const setAdvanced = (advanced: boolean) => updateSettings((s) => ({ ...s, advanced }));

  if (!settings.advanced) {
    // What the advanced view changes and the simple one does not show.
    const kept = huntableArmy(form.available, settings.reserve);
    const reserved = Object.fromEntries(
      Object.entries(form.available).map(([key, count]) => [key, count - (kept[key] ?? 0)]),
    );
    const custom = [
      ...(levels.weapons !== readLevels.weapons ||
      levels.shield !== readLevels.shield ||
      levels.huntSpeed !== readLevels.huntSpeed ||
      levels.cochineal !== readLevels.cochineal
        ? ["niveaux modifiés"]
        : []),
      ...(launchEdit !== null || arrivalEdit !== null ? ["TdC modifié"] : []),
      ...(huntCount !== null
        ? [`${String(huntCount)} chasse${huntCount > 1 ? "s" : ""} imposée${huntCount > 1 ? "s" : ""}`]
        : []),
      ...(huntAmount !== null ? [`${formatNumber(huntAmount)} cm² par chasse imposés`] : []),
      ...(override ? ["chasses changées à la main"] : []),
      ...(Object.values(reserved).some((count) => count > 0) ? [`${unitsText(reserved)} gardées à la maison`] : []),
    ];
    return (
      <div className="hunt-launcher optizzz-panel">
        {header}
        <SimpleView
          settings={settings}
          updateSettings={(change) => {
            reset();
            setHuntAmount(null);
            updateSettings(change);
          }}
          plan={hasPlan ? plan : null}
          layingSpeed={layingSpeed}
          hasTroops={UNITS.some((unit) => unit.key !== "JSN" && unit.promotesTo && (form.available[unit.key] ?? 0) > 0)}
          custom={custom}
          onAdvanced={() => setAdvanced(true)}
          now={now}
        />
        {notices}
        {launchArea}
        {ongoingList}
        <p className="mode">
          <button type="button" className="optizzz-button-link" onClick={() => setAdvanced(true)}>
            Réglages avancés : niveaux, armée envoyée, TdC, ratio précis, nombre et surface des chasses…
          </button>
        </p>
      </div>
    );
  }

  return (
    <div className="hunt-launcher optizzz-panel">
      {header}
      <p className="mode">
        <button type="button" className="optizzz-button-link" onClick={() => setAdvanced(false)}>
          Revenir à l'affichage simple
        </button>
      </p>

      {section(
        "data",
        "Vos données",
        <PlayerData
          read={readLevels}
          levels={levels}
          onLevel={(level, value) => {
            setLevelEdits((edits) => ({
              ...edits,
              [level]: value === null || value === readLevels[level] ? undefined : value,
            }));
          }}
          layingSpeed={layingSpeed}
          available={form.available}
          reserve={settings.reserve}
          onSend={(unit, count) => {
            updateSettings((s) => ({
              ...s,
              reserve: { ...s.reserve, [unit]: Math.max(0, (form.available[unit] ?? 0) - count) },
            }));
          }}
          probes={probes}
        />,
        input.army.some((count) => count > 0) ? unitsText(armyToKeys(input.army)) : undefined,
      )}

      {section(
        "parameters",
        "Paramètres de chasse",
        <HuntParameters
          settings={settings}
          updateSettings={(change) => {
            reset();
            updateSettings(change);
          }}
          launchField={launchField}
          arrivalField={arrivalField}
          readLaunchField={currentField}
          readArrivalField={launchField + ongoingGain}
          onLaunchField={setLaunchEdit}
          onArrivalField={setArrivalEdit}
          huntCount={huntCount}
          huntAmount={huntAmount}
          planCount={answer?.hunts.length ?? 1}
          planAmount={answer?.hunts[0]?.amount ?? 1}
          slots={slots}
          onHuntCount={setHuntCount}
          onHuntAmount={setHuntAmount}
          ratioChoices={ratioChoices}
          huntSpeed={levels.huntSpeed}
          now={now}
        />,
      )}

      {notices}

      {hasPlan && (
        <>
          {section(
            "result",
            "Informations sur la chasse",
            <HuntResult
              plan={plan}
              field={input.field}
              layingSpeed={layingSpeed}
              wavesAsked={settings.dispatch === "waves"}
              now={now}
            />,
          )}

          {section(
            "byField",
            "Pertes selon le TdC à l'arrivée",
            extras ? <FieldTable rows={extras.byField} field={input.field} /> : <p className="optizzz-note">Calcul…</p>,
          )}

          {section("launch", "Lancement des chasses", launchArea)}

          {section(
            "details",
            "Détails",
            <HuntDetails
              plan={plan}
              advised={answer}
              extras={extras}
              custom={override !== null || huntAmount !== null}
              frozen={frozen}
              waitSeconds={waiting?.waitSeconds ?? null}
              onPickAmount={setHuntAmount}
            />,
            "Calystene, promotions, courbe, conseils",
          )}
        </>
      )}

      {ongoingList}
    </div>
  );
}

function summaryText(plan: Plan | null, now: Date, computing: boolean): string {
  if (!plan) return computing ? "calcul…" : "";
  if (plan.hunts.length === 0) return "aucune chasse possible";
  const lost = plan.hunts.reduce((sum, hunt) => sum + hunt.outcome.lostUnits.mean, 0);
  const back = formatEndTime(new Date(now.getTime() + plan.durationSeconds * 1000), now);
  return `${huntsText(plan)} · +${formatAmount(plan.totalAmount)} cm² · retour ${back} · ≈ ${formatAmount(lost)} pertes`;
}
