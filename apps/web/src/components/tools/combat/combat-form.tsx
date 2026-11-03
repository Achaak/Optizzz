"use client";

// The two sides of the combat simulator: levels, army (by place for the defender), and an army pasted as text.
// See docs/features/site-combat.md.
import { readArmyText, type Counts } from "@optizzz/game/army/army-text";
import { unitLabel } from "@optizzz/game/army/units";
import { type Place } from "@optizzz/game/army/battle";
import type { AttackerForm, DefenderForm } from "@optizzz/game/army/battle-form";

import type { NumberFieldRules } from "@optizzz/game/format/number-field";
import { useId, useState, type ReactNode } from "react";
import { NumberField } from "~/components/number-field";
import { Button } from "~/components/ui/button";
import { cn } from "cn";
import { NoUnit, UnitName, useShownUnits, type Unit } from "../unit-rows";
import { PLACE_LABELS } from "./combat-result";

const LEVEL: NumberFieldRules = { min: 0, max: 1000, integer: true, allowEmpty: true };
const AMOUNT: NumberFieldRules = {
  min: 0,
  max: Number.MAX_SAFE_INTEGER,
  integer: true,
  amount: true,
  allowEmpty: true,
};

/** A whole number at least 0, shown empty at 0. */
export function CountField({
  value,
  onChange,
  rules,
  label,
  className,
}: {
  value: number;
  onChange: (value: number) => void;
  rules: NumberFieldRules;
  label: string;
  className?: string;
}) {
  return (
    <NumberField
      aria-label={label}
      placeholder="0"
      className={className}
      value={value === 0 ? null : value}
      onCommit={(next) => onChange(next ?? 0)}
      rules={rules}
    />
  );
}

interface LevelInput<Key extends string> {
  key: Key;
  label: string;
  amount?: boolean;
}

function Levels<Key extends string>({
  fields,
  values,
  onChange,
}: {
  fields: readonly LevelInput<Key>[];
  values: Record<Key, number>;
  onChange: (key: Key, value: number) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2.5 border-b px-4 py-3.5">
      {fields.map((field) => (
        <label key={field.key} className="space-y-1 text-sm">
          <span className="block text-xs text-muted-foreground font-medium">{field.label}</span>
          <CountField
            label={field.label}
            value={values[field.key]}
            rules={field.amount ? AMOUNT : LEVEL}
            onChange={(value) => onChange(field.key, value)}
          />
        </label>
      ))}
    </div>
  );
}

/** A pasted report (« Troupes en défense : … ») or a « 300 Jeunes Soldates, 2 Tanks » list fills an army. */
export function Paste({
  role,
  onArmy,
  extra,
}: {
  role: "attack" | "defense";
  onArmy: (army: Counts) => void;
  extra?: ReactNode;
}) {
  const id = useId();
  const [text, setText] = useState("");
  const [unknown, setUnknown] = useState<string[]>([]);
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm text-muted-foreground">
        Coller un rapport (« Troupes en {role === "attack" ? "attaque" : "défense"} : … ») ou une liste « 300 Jeunes
        Soldates, 2 Tanks »
      </label>
      <textarea
        id={id}
        rows={2}
        value={text}
        onChange={(event) => setText(event.target.value)}
        className="w-full min-w-0 border border-input bg-transparent px-2.5 py-1.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30 rounded-lg"
      />
      <div className="flex flex-wrap items-center gap-2">
        {extra}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!text.trim()}
          onClick={() => {
            const read = readArmyText(text, role);
            onArmy(read.army);
            setUnknown(read.unknown);
          }}
        >
          Remplir
        </Button>
      </div>
      {unknown.length > 0 && (
        <p role="status" className="text-sm text-muted-foreground">
          Unités inconnues ignorées : {unknown.join(", ")}
        </p>
      )}
    </div>
  );
}

const ATTACKER_LEVELS = [
  { key: "weapons", label: "Armes" },
  { key: "shield", label: "Bouclier Thoracique" },
  { key: "field", label: "TDC (cm²)", amount: true },
  { key: "aphids", label: "Étable à pucerons" },
] as const satisfies readonly LevelInput<keyof AttackerForm>[];

const DEFENDER_LEVELS = [
  { key: "weapons", label: "Armes" },
  { key: "shield", label: "Bouclier Thoracique" },
  { key: "dome", label: "Dôme" },
  { key: "lodge", label: "Loge Impériale" },
  { key: "field", label: "TDC (cm²)", amount: true },
  { key: "food", label: "Nourriture", amount: true },
  { key: "materials", label: "Matériaux", amount: true },
] as const satisfies readonly LevelInput<keyof DefenderForm>[];

type AttackerNumber = (typeof ATTACKER_LEVELS)[number]["key"];
type DefenderNumber = (typeof DEFENDER_LEVELS)[number]["key"];

const COUNT_CLASS = "h-9 w-full min-w-0 text-right tabular-nums";

/**
 * One side as the mockup draws it: its name in its colour (and its arrow, never the colour alone: ADR 0003), a note
 * on the right, its levels, its army, and « + Unité » and « Coller l'armée du jeu » across the foot.
 */
function SideCard({
  side,
  note,
  levels,
  army,
  rest,
  onAdd,
  paste,
}: {
  side: "attack" | "defense";
  note?: ReactNode;
  levels: ReactNode;
  army: ReactNode;
  rest: Unit[];
  onAdd: (key: string) => void;
  paste: ReactNode;
}) {
  const titleId = useId();
  const pasteId = useId();
  const [pasting, setPasting] = useState(false);
  const attack = side === "attack";
  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        "flex min-w-0 flex-col border-t-3 bg-card text-card-foreground rounded-[0.875rem] shadow-panel",
        attack ? "border-t-primary" : "border-t-info",
      )}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b px-4 py-2.5">
        <h2
          id={titleId}
          className={cn("font-heading text-[1.375rem] font-semibold uppercase", attack ? "text-primary" : "text-info")}
        >
          {attack ? "◀ Attaquant" : "Défenseur ▶"}
        </h2>
        {note && <span className="text-xs text-muted-foreground">{note}</span>}
      </header>
      {levels}
      <div className="px-4 py-2.5">{army}</div>
      {pasting && (
        <div id={pasteId} className="border-t px-4 py-3">
          {paste}
        </div>
      )}
      <div className="mt-auto flex border-t">
        {rest.length > 0 && (
          <select
            aria-label="Ajouter une unité"
            value=""
            onChange={(event) => {
              if (event.target.value) onAdd(event.target.value);
            }}
            className="h-10 min-w-0 flex-1 cursor-pointer appearance-none border-r bg-transparent px-2 text-sm [text-align-last:center] hover:bg-accent"
          >
            <option value="">+ Unité</option>
            {rest.map((unit) => (
              <option key={unit.key} value={unit.key}>
                {unitLabel(unit.key)} · {unit.name}
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          aria-expanded={pasting}
          aria-controls={pasting ? pasteId : undefined}
          onClick={() => setPasting((open) => !open)}
          className={cn("h-10 min-w-0 flex-1 px-2 text-sm hover:bg-accent", pasting && "bg-accent font-semibold")}
        >
          Coller l&apos;armée du jeu
        </button>
      </div>
    </section>
  );
}

export function AttackerSide({
  attacker,
  note,
  onNumber,
  onArmy,
}: {
  attacker: AttackerForm;
  note?: ReactNode;
  onNumber: (key: AttackerNumber, value: number) => void;
  onArmy: (army: Counts) => void;
}) {
  const units = useShownUnits((unit) => (attacker.army[unit.key] ?? 0) > 0);
  return (
    <SideCard
      side="attack"
      note={note}
      levels={<Levels fields={ATTACKER_LEVELS} values={attacker} onChange={onNumber} />}
      army={
        units.shown.length === 0 ? (
          <NoUnit />
        ) : (
          <div className="space-y-1.5">
            {units.shown.map((unit) => (
              <label key={unit.key} className="grid grid-cols-[minmax(0,1fr)_7.5rem] items-center gap-2">
                <UnitName unit={unit} />
                <CountField
                  label={unit.name}
                  className={COUNT_CLASS}
                  rules={AMOUNT}
                  value={attacker.army[unit.key] ?? 0}
                  onChange={(count) => onArmy({ ...attacker.army, [unit.key]: count })}
                />
              </label>
            ))}
          </div>
        )
      }
      rest={units.rest}
      onAdd={units.add}
      paste={<Paste role="attack" onArmy={onArmy} />}
    />
  );
}

const PLACE_IN: Record<Place, string> = {
  field: "du Terrain de chasse",
  nest: "de la Fourmilière",
  lodge: "de la Loge Impériale",
};

/** « armée du Terrain de chasse », « armées du Terrain de chasse et de la Fourmilière », « armées des trois lieux ». */
const armiesNote = (places: readonly Place[]) =>
  places.length === 1
    ? `armée ${PLACE_IN[places[0] ?? "field"]}`
    : places.length === 2
      ? `armées ${PLACE_IN[places[0] ?? "field"]} et ${PLACE_IN[places[1] ?? "nest"]}`
      : "armées des trois lieux";

/** The defender: the armies of the places the attack goes through (the hunting field first, up to the target). */
export function DefenderSide({
  defender,
  places,
  note,
  onNumber,
  onArmy,
}: {
  defender: DefenderForm;
  places: readonly Place[];
  note?: ReactNode;
  onNumber: (key: DefenderNumber, value: number) => void;
  onArmy: (place: Place, army: Counts) => void;
}) {
  const [chosenPastePlace, setPastePlace] = useState<Place | null>(null);
  const pastePlace =
    chosenPastePlace && places.includes(chosenPastePlace) ? chosenPastePlace : (places[places.length - 1] ?? "field");
  const units = useShownUnits((unit) => places.some((place) => (defender.armies[place][unit.key] ?? 0) > 0));
  const several = places.length > 1;
  // One place: « SN Soldate Naine » and its count, as the mockup draws it; several: the abbreviation, then a column a place.
  const columns = {
    gridTemplateColumns: several
      ? `minmax(2.25rem, auto) repeat(${String(places.length)}, minmax(0, 1fr))`
      : "minmax(0, 1fr) 7.5rem",
  };
  return (
    <SideCard
      side="defense"
      note={
        <>
          {note && <>{note} · </>}
          {armiesNote(places)}
        </>
      }
      levels={<Levels fields={DEFENDER_LEVELS} values={defender} onChange={onNumber} />}
      army={
        units.shown.length === 0 ? (
          <NoUnit />
        ) : (
          <div role={several ? "table" : undefined} aria-label={several ? "Armée du défenseur" : undefined}>
            {several && (
              <div role="row" className="grid items-end gap-2 pb-1" style={columns}>
                {/* sr-only alone would leave the grid's flow and shift the heads by a column. */}
                <span role="columnheader">
                  <span className="sr-only">Unité</span>
                </span>
                {places.map((place) => (
                  <span
                    key={place}
                    role="columnheader"
                    className="text-right text-xs leading-tight break-words text-muted-foreground font-medium"
                  >
                    {PLACE_LABELS[place]}
                  </span>
                ))}
              </div>
            )}
            <div className="space-y-1.5">
              {units.shown.map((unit) => (
                <div
                  key={unit.key}
                  role={several ? "row" : undefined}
                  className="grid items-center gap-2"
                  style={columns}
                >
                  {several ? (
                    <span role="rowheader" title={unit.name}>
                      <strong className="font-mono">{unitLabel(unit.key)}</strong>
                      <span className="sr-only"> {unit.name}</span>
                    </span>
                  ) : (
                    <UnitName unit={unit} />
                  )}
                  {places.map((place) => (
                    <span key={place} role={several ? "cell" : undefined}>
                      <CountField
                        label={`${unit.name}, ${PLACE_LABELS[place]}`}
                        className={COUNT_CLASS}
                        rules={AMOUNT}
                        value={defender.armies[place][unit.key] ?? 0}
                        onChange={(count) => onArmy(place, { ...defender.armies[place], [unit.key]: count })}
                      />
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )
      }
      rest={units.rest}
      onAdd={units.add}
      paste={
        <Paste
          role="defense"
          onArmy={(army) => onArmy(pastePlace, army)}
          extra={
            several && (
              <label className="flex items-center gap-2 text-sm">
                Lieu :
                <select
                  value={pastePlace}
                  onChange={(event) => setPastePlace(event.target.value as Place)}
                  className="h-8 border border-input bg-transparent px-2 text-sm dark:bg-input/30 rounded-lg"
                >
                  {places.map((place) => (
                    <option key={place} value={place}>
                      {PLACE_LABELS[place]}
                    </option>
                  ))}
                </select>
              </label>
            )
          }
        />
      }
    />
  );
}
