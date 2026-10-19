import { useState } from "react";
import { REFERENCE_RATIOS } from "./engine/calystene";
import { amountForDuration, huntDurationSeconds } from "./engine/difficulty";
import type { RatioChoice } from "./engine/extras";
import type { Dispatch, ObjectiveKind, Settings } from "./settings";
import { parisClockTime, ratioOptionText } from "./view";
import { formatAmount, formatNumber } from "@/utils/number-format";
import { NumberField } from "@/utils/NumberField";
import { formatEndTime } from "@/utils/time-format";

interface Props {
  settings: Settings;
  updateSettings: (change: (current: Settings) => Settings) => void;
  /** Field when the hunts leave (it sets their duration), and when they fight. */
  launchField: number;
  arrivalField: number;
  /** What the game shows, to come back to. */
  readLaunchField: number;
  readArrivalField: number;
  onLaunchField: (field: number | null) => void;
  onArrivalField: (field: number | null) => void;
  /** Null: the planner chooses. */
  huntCount: number | null;
  huntAmount: number | null;
  /** What the planner chose, shown in the fields left on « Auto ». */
  planCount: number;
  planAmount: number;
  slots: number;
  onHuntCount: (count: number | null) => void;
  onHuntAmount: (amount: number | null) => void;
  ratioChoices: RatioChoice[] | null;
  huntSpeed: number;
  now: Date;
}

const OBJECTIVES: { kind: ObjectiveKind; label: string; hint: string }[] = [
  { kind: "ratio", label: "Ratio", hint: "attaque / difficulté, comme le simulateur de Calystene" },
  { kind: "yield", label: "Rendement", hint: "le plus de cm² pour une part de pertes que vous fixez" },
];
const DISPATCHES: { kind: Dispatch; label: string; hint: string }[] = [
  { kind: "mix", label: "Mêlée", hint: "le même mélange d'unités dans chaque chasse" },
  {
    kind: "waves",
    label: "Par vagues",
    hint: "les unités qui peuvent encore monter ensemble dans les dernières chasses, comme le simulateur de Calystene",
  },
];
const DAYS = ["aujourd'hui", "demain", "après-demain"];

/** « Paramètres de chasse »: fields, objective, how many hunts and how big. */
export function HuntParameters(props: Props) {
  const { settings, updateSettings, huntCount, huntAmount, slots, now } = props;
  return (
    <div className="parameters">
      <div className="grid">
        <label className="row">
          <span title="Votre TDC quand les chasses partent : il fixe leur durée.">TdC au lancement</span>
          <NumberField
            min={1}
            integer
            amount
            className="wide"
            value={props.launchField}
            onCommit={(value) => {
              if (value !== null) props.onLaunchField(value);
            }}
          />
          {props.launchField !== props.readLaunchField && (
            <button type="button" className="optizzz-button-link" onClick={() => props.onLaunchField(null)}>
              revenir à {formatAmount(props.readLaunchField)}
            </button>
          )}
        </label>
        <label className="row">
          <span title="Votre TDC quand les chasses combattront : celui d'aujourd'hui plus ce que rapportent les chasses en cours. Changez-le si vous attendez un flood.">
            TdC à l'arrivée
          </span>
          <NumberField
            min={1}
            integer
            amount
            className="wide"
            value={props.arrivalField}
            onCommit={(value) => {
              if (value !== null) props.onArrivalField(value);
            }}
          />
          {props.arrivalField !== props.readArrivalField && (
            <button type="button" className="optizzz-button-link" onClick={() => props.onArrivalField(null)}>
              revenir à {formatAmount(props.readArrivalField)}
            </button>
          )}
        </label>
      </div>

      <div className="objective">
        <div className="optizzz-segmented" role="group" aria-label="Objectif">
          {OBJECTIVES.map((o) => (
            <button
              key={o.kind}
              type="button"
              title={o.hint}
              aria-pressed={settings.objective === o.kind}
              onClick={() => {
                updateSettings((s) => ({ ...s, objective: o.kind }));
                props.onHuntAmount(null);
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
        {settings.objective === "ratio" ? (
          <label className="ratio">
            <span className="optizzz-muted">ratio</span>
            <select
              value={settings.ratio}
              onChange={(e) => {
                updateSettings((s) => ({ ...s, ratio: Number(e.target.value) }));
                props.onHuntAmount(null);
              }}
            >
              {REFERENCE_RATIOS.map((ratio) => (
                <option key={ratio} value={ratio}>
                  {ratioOptionText(
                    ratio,
                    props.ratioChoices?.find((choice) => choice.ratio === ratio),
                  )}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label>
            pertes jusqu'à{" "}
            <NumberField
              min={0.1}
              max={20}
              step={0.1}
              value={Math.round(settings.maxLossShare * 1000) / 10}
              onCommit={(percent) => {
                if (percent !== null) updateSettings((s) => ({ ...s, maxLossShare: percent / 100 }));
                props.onHuntAmount(null);
              }}
            />{" "}
            % de l'armée envoyée (en nourriture, 9 fois sur 10)
          </label>
        )}
      </div>
      {settings.objective === "ratio" && (
        <p className="optizzz-note">
          Plus le ratio est haut, moins vous perdez et moins vous chassez. Réplique 10 % : chance de « réplique » selon
          les tables de Calystene. Pertes : unités perdues en moyenne, toutes chasses comprises.
        </p>
      )}

      <div className="grid">
        <div className="row">
          <label htmlFor="hunt-count">Nombre de chasses</label>
          <NumberField
            id="hunt-count"
            min={1}
            max={Math.max(1, slots)}
            integer
            value={huntCount ?? Math.max(1, props.planCount)}
            disabled={huntCount === null}
            onCommit={(count) => {
              if (count !== null) props.onHuntCount(count);
            }}
          />
          <label className="auto">
            <input
              type="checkbox"
              checked={huntCount === null}
              onChange={(e) => {
                props.onHuntCount(e.target.checked ? null : Math.max(1, props.planCount));
              }}
            />
            Auto
          </label>
          <span className="optizzz-muted">
            {slots} créneau{slots > 1 ? "x" : ""} libre{slots > 1 ? "s" : ""}
          </span>
        </div>
        <div className="row">
          <label htmlFor="hunt-amount">TdC par chasse</label>
          <NumberField
            id="hunt-amount"
            min={1}
            integer
            amount
            className="wide"
            value={huntAmount ?? props.planAmount}
            disabled={huntAmount === null}
            onCommit={(amount) => {
              if (amount !== null) props.onHuntAmount(amount);
            }}
          />
          <span>cm²</span>
          <label className="auto">
            <input
              type="checkbox"
              checked={huntAmount === null}
              onChange={(e) => {
                props.onHuntAmount(e.target.checked ? null : Math.max(1, props.planAmount));
              }}
            />
            Auto
          </label>
        </div>
      </div>
      {huntAmount !== null && (
        <p className="optizzz-note">
          Surface choisie : l'objectif ne la limite plus, regardez le ratio et les pertes avant de lancer.
        </p>
      )}

      <div className="objective">
        <span>Répartition</span>
        <div className="optizzz-segmented" role="group" aria-label="Répartition des unités">
          {DISPATCHES.map((d) => (
            <button
              key={d.kind}
              type="button"
              title={d.hint}
              aria-pressed={settings.dispatch === d.kind}
              onClick={() => {
                updateSettings((s) => ({ ...s, dispatch: d.kind }));
              }}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>
      {settings.dispatch === "waves" && (
        <p className="optizzz-note">
          Les unités qui peuvent encore monter selon Calystene (Tueuses, Tanks, Artilleuses, Concierges, Soldates,
          Jeunes Soldates, Soldates Naines) partent ensemble dans les dernières chasses, derrière juste assez de JSN
          pour rentrer indemnes (simulé) ; les autres et le gros des JSN partent dans les premières. Mêmes surfaces et à
          peu près mêmes pertes : plus de troupes promues (surtout Soldates, Artilleuses, Tueuses), un peu moins de JSN.
          Si les vagues ne font pas mieux que les unités mêlées, Optizzz garde les unités mêlées et le dit.
        </p>
      )}

      <ReturnTarget
        launchField={props.launchField}
        huntSpeed={props.huntSpeed}
        now={now}
        onUse={(amount) => props.onHuntAmount(amount)}
      />
    </div>
  );
}

/** « Retour souhaité »: the largest surface back by a time the player picks. */
function ReturnTarget({
  launchField,
  huntSpeed,
  now,
  onUse,
}: {
  launchField: number;
  huntSpeed: number;
  now: Date;
  onUse: (amount: number) => void;
}) {
  const [day, setDay] = useState(0);
  const [clock, setClock] = useState("");
  const target = clock ? parisClockTime(now, day, clock) : null;
  const amount = target ? amountForDuration(launchField, (target.getTime() - now.getTime()) / 1000, huntSpeed) : 0;
  const earliest = new Date(now.getTime() + huntDurationSeconds(launchField, 1, huntSpeed) * 1000);
  return (
    <div className="return-target row">
      <span>Retour souhaité</span>
      <select
        aria-label="Jour du retour"
        value={day}
        onChange={(e) => {
          setDay(Number(e.target.value));
        }}
      >
        {DAYS.map((name, i) => (
          <option key={name} value={i}>
            {name}
          </option>
        ))}
      </select>
      <input
        type="time"
        aria-label="Heure du retour (heure de Paris)"
        value={clock}
        onChange={(e) => {
          setClock(e.target.value);
        }}
      />
      {target === null ? (
        <span className="optizzz-muted">pas avant {formatEndTime(earliest, now)}</span>
      ) : amount < 1 ? (
        <span className="optizzz-text-warning">trop tôt : pas avant {formatEndTime(earliest, now)}</span>
      ) : (
        <>
          <span>
            → <strong>{formatNumber(amount)} cm²</strong> par chasse
          </span>
          <button
            type="button"
            onClick={() => {
              onUse(amount);
            }}
          >
            Utiliser
          </button>
        </>
      )}
    </div>
  );
}
