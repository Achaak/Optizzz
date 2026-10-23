"use client";

// « Paramètres de chasse » of the advanced display: field at arrival, objective, how many hunts and how big, hunts
// already away, dispatch, wished return. As the extension's launcher. See docs/features/site-chasse.md.
import { formatNumber } from "@optizzz/game/format/number-format";
import { formatEndTime } from "@optizzz/game/format/time-format";
import { REFERENCE_RATIOS } from "@optizzz/game/hunt/calystene";
import { amountForDuration, huntDurationSeconds } from "@optizzz/game/hunt/difficulty";
import type { RatioChoice } from "@optizzz/game/hunt/extras";
import { freeSlots, type HuntForm } from "@optizzz/game/hunt/hunt-form";
import { parisClockTime, ratioOptionText } from "@optizzz/game/hunt/texts";
import { useState, type ReactNode } from "react";
import { NumberField } from "~/components/number-field";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { AMOUNT, LEVEL } from "./hunt-entries";
import { Check, Note, Segmented, SELECT_CLASS } from "./hunt-parts";

const OBJECTIVES = [
  { value: "ratio", label: "Ratio", hint: "attaque / difficulté, comme le simulateur de Calystene" },
  { value: "yield", label: "Rendement", hint: "le plus de cm² pour une part de pertes que vous fixez" },
] as const;

const DISPATCHES = [
  { value: "mix", label: "Mêlée", hint: "le même mélange d'unités dans chaque chasse" },
  {
    value: "waves",
    label: "Par vagues",
    hint: "les unités qui peuvent encore monter ensemble dans les dernières chasses, comme le simulateur de Calystene",
  },
] as const;

const DAYS = ["aujourd'hui", "demain", "après-demain"];

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 text-sm sm:grid-cols-[11rem_1fr] sm:items-center sm:gap-3">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex min-w-0 flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

export function HuntParameters({
  form,
  onSettings,
  ratioChoices,
  planCount,
  planAmount,
  now,
}: {
  form: HuntForm;
  /** A change of setting; the hunts changed by hand are dropped. */
  onSettings: (change: Partial<HuntForm>) => void;
  ratioChoices: RatioChoice[] | null;
  /** What the planner chose, shown in the fields left on « Auto ». */
  planCount: number;
  planAmount: number;
  now: Date;
}) {
  const huntSpeed = form.levels.huntSpeed;
  const slots = huntSpeed === null ? null : freeSlots(huntSpeed, form.takenSlots);
  return (
    <div className="space-y-4">
      <Row label="TdC à l'arrivée">
        <NumberField
          aria-label="TdC à l'arrivée"
          className="w-36"
          placeholder={form.launchField === null ? "comme au lancement" : formatNumber(form.launchField)}
          value={form.arrivalField}
          onCommit={(arrivalField) => onSettings({ arrivalField })}
          rules={{ ...AMOUNT, min: 1 }}
        />
        <span className="text-muted-foreground">cm², quand la première chasse combat (vide : celui du lancement)</span>
      </Row>

      <Row label="Objectif">
        <Segmented
          label="Objectif"
          value={form.objective}
          options={OBJECTIVES}
          onChange={(objective) => onSettings({ objective, huntAmount: null })}
        />
      </Row>
      {form.objective === "ratio" ? (
        <Row label="Ratio">
          <select
            aria-label="Ratio"
            className={`${SELECT_CLASS} w-full sm:w-auto`}
            value={form.ratio}
            onChange={(event) => onSettings({ ratio: Number(event.target.value), huntAmount: null })}
          >
            {!REFERENCE_RATIOS.some((ratio) => ratio === form.ratio) && (
              <option value={form.ratio}>{ratioOptionText(form.ratio, undefined)}</option>
            )}
            {REFERENCE_RATIOS.map((ratio) => (
              <option key={ratio} value={ratio}>
                {ratioOptionText(
                  ratio,
                  ratioChoices?.find((choice) => choice.ratio === ratio),
                )}
              </option>
            ))}
          </select>
        </Row>
      ) : (
        <Row label="Pertes jusqu'à">
          <NumberField
            aria-label="Pertes acceptées, en %"
            className="w-20"
            value={Math.round(form.maxLossShare * 1000) / 10}
            onCommit={(percent) => {
              if (percent !== null) onSettings({ maxLossShare: percent / 100, huntAmount: null });
            }}
            rules={{ min: 0.1, max: 20 }}
          />
          <span className="text-muted-foreground">% de l&apos;armée envoyée (en nourriture, 9 fois sur 10)</span>
        </Row>
      )}
      {form.objective === "ratio" && (
        <Note>
          Plus le ratio est haut, moins vous perdez et moins vous chassez. Réplique 10 % : chance de « réplique » selon
          les tables de Calystene. Pertes : unités perdues en moyenne, toutes chasses comprises.
        </Note>
      )}

      <Row label="Chasses déjà en cours">
        <NumberField
          aria-label="Chasses déjà en cours"
          className="w-20"
          value={form.takenSlots}
          onCommit={(taken) => onSettings({ takenSlots: taken ?? 0 })}
          rules={{ ...LEVEL, allowEmpty: false }}
        />
        <span className="text-muted-foreground">
          {slots === null
            ? "créneaux libres : Vitesse de chasse + 1, moins celles-ci"
            : `${String(slots)} créneau${slots > 1 ? "x" : ""} libre${slots > 1 ? "s" : ""}`}
        </span>
      </Row>
      <Row label="Nombre de chasses">
        <NumberField
          aria-label="Nombre de chasses"
          className="w-20"
          value={form.huntCount ?? Math.max(1, planCount)}
          disabled={form.huntCount === null}
          onCommit={(count) => {
            if (count !== null) onSettings({ huntCount: count });
          }}
          rules={{ min: 1, max: Math.max(1, slots ?? 1), integer: true }}
        />
        <Check
          checked={form.huntCount === null}
          onChange={(auto) => onSettings({ huntCount: auto ? null : Math.max(1, planCount) })}
        >
          Auto
        </Check>
      </Row>
      <Row label="TdC par chasse">
        <NumberField
          aria-label="TdC par chasse"
          className="w-36"
          value={form.huntAmount ?? planAmount}
          disabled={form.huntAmount === null}
          onCommit={(amount) => {
            if (amount !== null) onSettings({ huntAmount: amount });
          }}
          rules={{ ...AMOUNT, min: 1, allowEmpty: false }}
        />
        <span className="text-muted-foreground">cm²</span>
        <Check
          checked={form.huntAmount === null}
          onChange={(auto) => onSettings({ huntAmount: auto ? null : Math.max(1, planAmount) })}
        >
          Auto
        </Check>
      </Row>
      {form.huntAmount !== null && (
        <Note>Surface choisie : l&apos;objectif ne la limite plus, regardez le ratio et les pertes.</Note>
      )}

      <Row label="Répartition">
        <Segmented
          label="Répartition des unités"
          value={form.dispatch}
          options={DISPATCHES}
          onChange={(dispatch) => onSettings({ dispatch })}
        />
      </Row>
      {form.dispatch === "waves" && (
        <Note>
          Les unités qui peuvent encore monter selon Calystene (Tueuses, Tanks, Artilleuses, Concierges, Soldates,
          Jeunes Soldates, Soldates Naines) partent ensemble dans les dernières chasses, derrière juste assez de JSN
          pour rentrer indemnes (simulé) ; les autres et le gros des JSN partent dans les premières. Si les vagues ne
          font pas mieux que les unités mêlées, Optizzz garde les unités mêlées et le dit.
        </Note>
      )}

      {form.launchField !== null && huntSpeed !== null && (
        <ReturnTarget
          launchField={form.launchField}
          huntSpeed={huntSpeed}
          now={now}
          onUse={(huntAmount) => onSettings({ huntAmount })}
        />
      )}
    </div>
  );
}

/** « Retour souhaité », counted from now (Paris time): the largest surface back by then. */
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
    <Row label="Retour souhaité">
      <select
        aria-label="Jour du retour"
        className={SELECT_CLASS}
        value={day}
        onChange={(event) => setDay(Number(event.target.value))}
      >
        {DAYS.map((name, i) => (
          <option key={name} value={i}>
            {name}
          </option>
        ))}
      </select>
      <Input
        type="time"
        aria-label="Heure du retour (heure de Paris)"
        className="w-28"
        value={clock}
        onChange={(event) => setClock(event.target.value)}
      />
      {target === null ? (
        <span className="text-muted-foreground">heure de Paris, pas avant {formatEndTime(earliest, now)}</span>
      ) : amount < 1 ? (
        <span>⚠ trop tôt : pas avant {formatEndTime(earliest, now)}</span>
      ) : (
        <>
          <span>
            → <strong>{formatNumber(amount)} cm²</strong> par chasse
          </span>
          <Button type="button" variant="outline" size="sm" onClick={() => onUse(amount)}>
            Utiliser
          </Button>
        </>
      )}
    </Row>
  );
}
