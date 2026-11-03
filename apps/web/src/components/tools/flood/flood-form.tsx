"use client";

// The flood simulator's inputs, as the « Campagne » mockup draws them: both fields (typed, or taken from the chosen
// players), the attacks on their way and the target's pasted defense, my army by unit, then my levels.
// See docs/features/site-flood.md.
import { countsToArmy, readArmyText } from "@optizzz/game/army/army-text";
import { UNITS, unitLabel, type Army } from "@optizzz/game/army/units";
import type { NumberFieldRules } from "@optizzz/game/format/number-field";
import type { FloodToolState } from "@optizzz/game/site-links/flood";
import { cn } from "cn";
import { useId, useState, type ReactNode } from "react";
import { NumberField } from "~/components/number-field";
import { SmallLabel, Panel } from "~/components/panel";
import { Button } from "~/components/ui/button";
import { CountField, Paste } from "../combat/combat-form";
import { AddUnit, NoUnit, useShownUnits } from "../unit-rows";
import { armyText } from "./flood-result";

const LEVEL: NumberFieldRules = { min: 0, max: 1000, integer: true, allowEmpty: true };
const AMOUNT: NumberFieldRules = {
  min: 0,
  max: Number.MAX_SAFE_INTEGER,
  integer: true,
  amount: true,
  allowEmpty: true,
};

/** A hint under a field, in plain text (the label above it is in mono capitals). */
function Hint({ children }: { children: ReactNode }) {
  return <span className="block text-xs text-muted-foreground">{children}</span>;
}

/** A labelled number field; `unit` (« cm² ») written inside it, on the right. */
function Field({
  label,
  value,
  rules,
  onCommit,
  unit,
  hint,
  className,
}: {
  label: string;
  value: number | null;
  rules: NumberFieldRules;
  onCommit: (value: number | null) => void;
  unit?: string;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block min-w-0 space-y-1", className)}>
      <SmallLabel className="block">{label}</SmallLabel>
      <span className="relative block">
        <NumberField
          aria-label={unit ? `${label} (${unit})` : label}
          value={value}
          rules={rules}
          onCommit={onCommit}
          className={cn("tabular-nums", unit && "pr-12")}
        />
        {unit && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-muted-foreground"
          >
            {unit}
          </span>
        )}
      </span>
      {hint && <Hint>{hint}</Hint>}
    </label>
  );
}

/** Both hunting fields (typed, or taken from the chosen players and still editable), and my attacks on their way. */
export function Fields({
  state,
  onChange,
  onUnderWay,
}: {
  state: FloodToolState;
  onChange: (key: "attackerField" | "targetField", value: number | null) => void;
  onUnderWay: (count: number) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field
        label="Votre TDC"
        unit="cm²"
        value={state.attackerField}
        rules={AMOUNT}
        onCommit={(value) => onChange("attackerField", value)}
      />
      <Field
        label="TDC de la cible"
        unit="cm²"
        value={state.targetField}
        rules={AMOUNT}
        onCommit={(value) => onChange("targetField", value)}
      />
      <p className="col-span-2 text-xs text-muted-foreground">
        Repris du dernier relevé du site pour un joueur choisi, toujours modifiables.
      </p>
      <UnderWayField value={state.underWay} onChange={onUnderWay} />
    </div>
  );
}

/** My attacks already on their way: each takes one of the slots. */
function UnderWayField({ value, onChange }: { value: number; onChange: (count: number) => void }) {
  return (
    <Field
      label="Attaques déjà en route"
      value={value === 0 ? null : value}
      rules={LEVEL}
      onCommit={(next) => onChange(next ?? 0)}
      hint="Chacune prend une place."
    />
  );
}

export type FloodLevelKey = "attackSpeed" | "weapons" | "shield";

const LEVELS: readonly { key: FloodLevelKey; label: string; hint: string }[] = [
  { key: "attackSpeed", label: "Vitesse d'attaque", hint: "+ 1 : attaques en même temps" },
  { key: "weapons", label: "Armes", hint: "Contre une défense seulement" },
  { key: "shield", label: "Bouclier Thoracique", hint: "Contre une défense seulement" },
];

export function LevelsPanel({
  state,
  onLevel,
  aside,
}: {
  state: FloodToolState;
  onLevel: (key: FloodLevelKey, value: number | null) => void;
  /** « Reprendre mes niveaux », when the extension is linked. */
  aside?: ReactNode;
}) {
  return (
    <Panel title="Vos niveaux" aside={aside}>
      <div className="grid grid-cols-2 items-start gap-3 sm:grid-cols-3">
        {LEVELS.map((level) => (
          <Field
            key={level.key}
            label={level.label}
            value={state[level.key]}
            rules={LEVEL}
            hint={level.hint}
            onCommit={(value) => onLevel(level.key, value)}
          />
        ))}
      </div>
    </Panel>
  );
}

/** The ants I send, all attacks together: a field per unit (« JSN », « SN »…), or pasted. */
export function ArmyPanel({ army, onArmy }: { army: Army; onArmy: (army: number[]) => void }) {
  const units = useShownUnits((unit) => (army[UNITS.indexOf(unit)] ?? 0) > 0);
  return (
    <Panel
      title="Votre armée"
      aside={
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-xs text-muted-foreground">toutes attaques confondues</span>
          <AddUnit rest={units.rest} onAdd={units.add} />
        </span>
      }
    >
      <div className="space-y-4">
        {units.shown.length === 0 ? (
          <NoUnit />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {units.shown.map((unit) => {
              const i = UNITS.indexOf(unit);
              return (
                <label key={unit.key} className="block min-w-0 space-y-1" title={unit.name}>
                  <SmallLabel className="block normal-case">{unitLabel(unit.key)}</SmallLabel>
                  <CountField
                    label={unit.name}
                    className="tabular-nums"
                    rules={AMOUNT}
                    value={army[i] ?? 0}
                    onChange={(count) => onArmy(UNITS.map((_, j) => (j === i ? count : (army[j] ?? 0))))}
                  />
                </label>
              );
            })}
          </div>
        )}
        <Paste role="attack" onArmy={(pasted) => onArmy(countsToArmy(pasted))} />
      </div>
    </Panel>
  );
}

/** The target's army on its hunting field, pasted as in the extension; unknown, nobody defends. */
export function DefenseField({
  defense,
  onDefense,
}: {
  defense: Army | null;
  onDefense: (army: number[] | null) => void;
}) {
  const id = useId();
  const [text, setText] = useState("");
  const [nothingRead, setNothingRead] = useState(false);
  const known = defense?.some((count) => count > 0) ? defense : null;
  return (
    <div className="space-y-2">
      <SmallLabel className="block">Sa défense sur le TDC</SmallLabel>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className={known ? "font-mono" : "text-muted-foreground"}>
          {known ? armyText(known) : "Inconnue, comptée comme nulle."}
        </span>
        {known && (
          <Button type="button" variant="link" size="sm" className="px-0" onClick={() => onDefense(null)}>
            Effacer
          </Button>
        )}
      </div>
      <label htmlFor={id} className="block text-xs text-muted-foreground">
        Facultative : collez un rapport de combat ou « 300 Jeunes Soldates Naines, 2 Tanks », son armée au Terrain de
        chasse. Ses niveaux étant inconnus, on prend les vôtres (Armes, Bouclier Thoracique).
      </label>
      <textarea
        id={id}
        rows={2}
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          setNothingRead(false);
        }}
        className="w-full min-w-0 border border-input bg-transparent px-2.5 py-1.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30 rounded-lg"
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!text.trim()}
        onClick={() => {
          const army = countsToArmy(readArmyText(text, "defense").army);
          // Nothing read is not « no defense »: the text stays for the visitor to fix.
          if (!army.some((count) => count > 0)) {
            setNothingRead(true);
            return;
          }
          onDefense(army);
          setText("");
        }}
      >
        Utiliser cette défense
      </Button>
      {nothingRead && (
        <p role="status" className="text-sm">
          Aucune unité reconnue dans ce texte : sa défense n&apos;a pas changé.
        </p>
      )}
    </div>
  );
}
