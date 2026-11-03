"use client";

// The rows of an army in a tool's form, as the mockups draw them: only the units with a count, « SN Soldate Naine »,
// and « + Unité » for the others.
import { UNITS, unitLabel } from "@optizzz/game/army/units";
import { useState } from "react";

export type Unit = (typeof UNITS)[number];

/** The units a side shows: those with a count and those just added; the others wait behind « + Unité ». */
export function useShownUnits(counted: (unit: Unit) => boolean) {
  const [added, setAdded] = useState<string[]>([]);
  const shown = UNITS.filter((unit) => counted(unit) || added.includes(unit.key));
  return {
    shown,
    rest: UNITS.filter((unit) => !shown.includes(unit)),
    add: (key: string) => setAdded((current) => [...current, key]),
  };
}

/** « SN Soldate Naine »: the game's abbreviation, then the name. */
export function UnitName({ unit }: { unit: Unit }) {
  return (
    <span>
      <strong className="font-mono">{unitLabel(unit.key)}</strong>{" "}
      <span className="text-muted-foreground">{unit.name}</span>
    </span>
  );
}

/** « + Unité »: one more unit to type a count for. */
export function AddUnit({ rest, onAdd }: { rest: Unit[]; onAdd: (key: string) => void }) {
  if (rest.length === 0) return null;
  return (
    <select
      aria-label="Ajouter une unité"
      value=""
      onChange={(event) => {
        if (event.target.value) onAdd(event.target.value);
      }}
      className="h-9 border bg-background px-2 text-sm rounded-lg"
    >
      <option value="">+ Unité</option>
      {rest.map((unit) => (
        <option key={unit.key} value={unit.key}>
          {unitLabel(unit.key)} · {unit.name}
        </option>
      ))}
    </select>
  );
}

/** Nothing typed yet on a side. */
export function NoUnit() {
  return (
    <p className="text-sm text-muted-foreground">
      Aucune unité : ajoutez-en une avec « + Unité », ou collez l&apos;armée du jeu plus bas.
    </p>
  );
}
