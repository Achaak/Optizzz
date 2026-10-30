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
import { cn } from "cn";
import { useState, type ReactNode } from "react";
import { NumberField } from "~/components/number-field";
import { MonoLabel } from "~/components/panel";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { AMOUNT, FIELD_CLASS, LabelledField, LEVEL, Suffix } from "./hunt-entries";
import { Check, Segmented, SELECT_CLASS } from "./hunt-parts";

const OBJECTIVES = [
  { value: "ratio", label: "Ratio", hint: "attaque / difficulté, comme le simulateur de Calystene" },
  { value: "yield", label: "Rendement", hint: "le plus de cm² pour une part de pertes que vous fixez" },
] as const;

const DISPATCHES = [
  { value: "mix", label: "Mêlée", short: "le même mélange dans chaque chasse" },
  { value: "waves", label: "Par vagues", short: "les troupes qui montent à la fin" },
] as const;

const DAYS = ["aujourd'hui", "demain", "après-demain"];

/** A setting as the mockup draws it: its label in small mono capitals, the controls, a grey hint under them. */
function Row({
  label,
  hint,
  wide,
  children,
}: {
  label: string;
  hint?: ReactNode;
  /** Across both columns of the grid. */
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div role="group" aria-label={label} className={cn("min-w-0 space-y-1", wide && "sm:col-span-2")}>
      <MonoLabel className="block">{label}</MonoLabel>
      <div className="flex min-w-0 flex-wrap items-center gap-2">{children}</div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
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
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <MonoLabel>Objectif</MonoLabel>
        <Segmented
          label="Objectif"
          value={form.objective}
          options={OBJECTIVES}
          onChange={(objective) => onSettings({ objective, huntAmount: null })}
        />
      </div>
      <div className="grid gap-x-3 gap-y-4 sm:grid-cols-2">
        {form.objective === "ratio" ? (
          <LabelledField label="Ratio" className="sm:col-span-2">
            <select
              aria-label="Ratio"
              className={cn(SELECT_CLASS, FIELD_CLASS, "w-full")}
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
          </LabelledField>
        ) : (
          <Row label="Pertes acceptées" hint="de l'armée envoyée, en nourriture, 9 fois sur 10" wide>
            <span className="relative block w-full sm:w-[calc(50%-0.375rem)]">
              <NumberField
                aria-label="Pertes acceptées, en %"
                className={cn(FIELD_CLASS, "pr-8")}
                value={Math.round(form.maxLossShare * 1000) / 10}
                onCommit={(percent) => {
                  if (percent !== null) onSettings({ maxLossShare: percent / 100, huntAmount: null });
                }}
                rules={{ min: 0.1, max: 20 }}
              />
              <Suffix>%</Suffix>
            </span>
          </Row>
        )}
        {form.objective === "ratio" && (
          <p className="text-xs text-muted-foreground sm:col-span-2">
            Plus le ratio est haut, moins vous perdez et moins vous chassez. Réplique 10 % : chance de « réplique »
            selon les tables de Calystene. Pertes : unités perdues en moyenne, toutes chasses comprises.
          </p>
        )}
        <Row label="TdC à l'arrivée" hint="quand la première chasse combat ; vide : celui du lancement">
          <span className="relative block w-full">
            <NumberField
              aria-label="TdC à l'arrivée, en cm²"
              className={cn(FIELD_CLASS, "pr-11")}
              placeholder={form.launchField === null ? "comme au lancement" : formatNumber(form.launchField)}
              value={form.arrivalField}
              onCommit={(arrivalField) => onSettings({ arrivalField })}
              rules={{ ...AMOUNT, min: 1 }}
            />
            <Suffix>cm²</Suffix>
          </span>
        </Row>

        <LabelledField label="Chasses déjà en cours">
          <NumberField
            aria-label="Chasses déjà en cours"
            className={FIELD_CLASS}
            value={form.takenSlots}
            onCommit={(taken) => onSettings({ takenSlots: taken ?? 0 })}
            rules={{ ...LEVEL, allowEmpty: false }}
          />
        </LabelledField>
        <Row
          label="Nombre de chasses"
          hint={
            slots === null
              ? "créneaux libres : Vitesse de chasse + 1, moins les chasses en cours"
              : `${String(slots)} créneau${slots > 1 ? "x" : ""} libre${slots > 1 ? "s" : ""}`
          }
        >
          <NumberField
            aria-label="Nombre de chasses"
            className={cn(FIELD_CLASS, "w-24")}
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
        <Row
          label="TdC par chasse"
          hint={
            form.huntAmount !== null
              ? "Surface choisie : l'objectif ne la limite plus, regardez le ratio et les pertes."
              : undefined
          }
        >
          <span className="relative block min-w-0 flex-1">
            <NumberField
              aria-label="TdC par chasse, en cm²"
              className={cn(FIELD_CLASS, "pr-11")}
              value={form.huntAmount ?? planAmount}
              disabled={form.huntAmount === null}
              onCommit={(amount) => {
                if (amount !== null) onSettings({ huntAmount: amount });
              }}
              rules={{ ...AMOUNT, min: 1, allowEmpty: false }}
            />
            <Suffix>cm²</Suffix>
          </span>
          <Check
            checked={form.huntAmount === null}
            onChange={(auto) => onSettings({ huntAmount: auto ? null : Math.max(1, planAmount) })}
          >
            Auto
          </Check>
        </Row>
        <Row
          label="Répartition des unités"
          hint={DISPATCHES.find((dispatch) => dispatch.value === form.dispatch)?.short}
        >
          <select
            aria-label="Répartition des unités"
            className={cn(SELECT_CLASS, FIELD_CLASS, "w-full")}
            value={form.dispatch}
            onChange={(event) => onSettings({ dispatch: event.target.value === "waves" ? "waves" : "mix" })}
          >
            {DISPATCHES.map((dispatch) => (
              <option key={dispatch.value} value={dispatch.value}>
                {dispatch.label}
              </option>
            ))}
          </select>
        </Row>
        {form.dispatch === "waves" && (
          <p className="text-xs text-muted-foreground sm:col-span-2">
            Les unités qui peuvent encore monter selon Calystene (Tueuses, Tanks, Artilleuses, Concierges, Soldates,
            Jeunes Soldates, Soldates Naines) partent ensemble dans les dernières chasses, derrière juste assez de JSN
            pour rentrer indemnes (simulé) ; les autres et le gros des JSN partent dans les premières. Si les vagues ne
            font pas mieux que les unités mêlées, Optizzz garde les unités mêlées et le dit.
          </p>
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
    <Row label="Retour souhaité" wide>
      <select
        aria-label="Jour du retour"
        className={cn(SELECT_CLASS, FIELD_CLASS)}
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
        className={cn(FIELD_CLASS, "w-28 font-mono")}
        value={clock}
        onChange={(event) => setClock(event.target.value)}
      />
      {target === null ? (
        <span className="text-sm text-muted-foreground">heure de Paris, pas avant {formatEndTime(earliest, now)}</span>
      ) : amount < 1 ? (
        <span className="text-sm">⚠ trop tôt : pas avant {formatEndTime(earliest, now)}</span>
      ) : (
        <>
          <span className="text-sm">
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
