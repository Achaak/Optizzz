"use client";

// The flood simulator's inputs: both fields (typed, or taken from the chosen players), my levels and army, and the
// target's pasted defense. See docs/features/site-flood.md.
import { countsToArmy, readArmyText } from "@optizzz/game/army/army-text";
import { UNITS, type Army } from "@optizzz/game/army/units";
import type { NumberFieldRules } from "@optizzz/game/format/number-field";
import type { FloodToolState } from "@optizzz/game/site-links/flood";
import { useId, useState } from "react";
import { NumberField } from "~/components/number-field";
import { Button } from "~/components/ui/button";
import { AddUnit, NoUnit, UnitName, useShownUnits } from "../unit-rows";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { CountField, Paste } from "../combat/combat-form";
import { armyText } from "./flood-result";

const LEVEL: NumberFieldRules = { min: 0, max: 1000, integer: true, allowEmpty: true };
const AMOUNT: NumberFieldRules = {
  min: 0,
  max: Number.MAX_SAFE_INTEGER,
  integer: true,
  amount: true,
  allowEmpty: true,
};

function Field({
  label,
  value,
  rules,
  onCommit,
}: {
  label: string;
  value: number | null;
  rules: NumberFieldRules;
  onCommit: (value: number | null) => void;
}) {
  return (
    <label className="space-y-1 text-sm">
      <span className="block font-mono text-[0.6875rem] tracking-widest text-muted-foreground uppercase">{label}</span>
      <NumberField aria-label={label} value={value} rules={rules} onCommit={onCommit} className="tabular-nums" />
    </label>
  );
}

/** Both hunting fields: typed, or taken from the chosen players and still editable. */
export function Fields({
  state,
  onChange,
}: {
  state: FloodToolState;
  onChange: (key: "attackerField" | "targetField", value: number | null) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field
        label="Votre TDC (cm²)"
        value={state.attackerField}
        rules={AMOUNT}
        onCommit={(value) => onChange("attackerField", value)}
      />
      <Field
        label="TDC de la cible (cm²)"
        value={state.targetField}
        rules={AMOUNT}
        onCommit={(value) => onChange("targetField", value)}
      />
    </div>
  );
}

export type FloodLevelKey = "attackSpeed" | "weapons" | "shield";

const LEVELS: readonly { key: FloodLevelKey; label: string }[] = [
  { key: "attackSpeed", label: "Vitesse d'attaque" },
  { key: "weapons", label: "Armes" },
  { key: "shield", label: "Bouclier Thoracique" },
];

export function LevelsCard({
  state,
  onLevel,
  onUnderWay,
}: {
  state: FloodToolState;
  onLevel: (key: FloodLevelKey, value: number | null) => void;
  onUnderWay: (count: number) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Vos niveaux</CardTitle>
        <CardDescription>
          Vitesse d&apos;attaque + 1 attaques en même temps, moins celles déjà en route. Armes et Bouclier ne servent
          que contre une défense.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-2 items-end gap-3 sm:grid-cols-4">
        {LEVELS.map((level) => (
          <Field
            key={level.key}
            label={level.label}
            value={state[level.key]}
            rules={LEVEL}
            onCommit={(value) => onLevel(level.key, value)}
          />
        ))}
        <Field
          label="Attaques déjà en route"
          value={state.underWay === 0 ? null : state.underWay}
          rules={LEVEL}
          onCommit={(value) => onUnderWay(value ?? 0)}
        />
      </CardContent>
    </Card>
  );
}

const COUNT_CLASS = "ml-auto w-28 min-w-24 text-right tabular-nums";

/** The ants I send, all attacks together: by unit, or pasted. */
export function ArmyCard({ army, onArmy }: { army: Army; onArmy: (army: number[]) => void }) {
  const units = useShownUnits((unit) => (army[UNITS.indexOf(unit)] ?? 0) > 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Votre armée</CardTitle>
        <CardDescription>Les fourmis que vous pouvez envoyer, toutes attaques confondues.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {units.shown.length === 0 ? (
          <NoUnit />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Unité</TableHead>
                <TableHead className="text-right">Nombre</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {units.shown.map((unit) => {
                const i = UNITS.indexOf(unit);
                return (
                  <TableRow key={unit.key}>
                    <TableCell>
                      <UnitName unit={unit} />
                    </TableCell>
                    <TableCell className="text-right">
                      <CountField
                        label={unit.name}
                        className={COUNT_CLASS}
                        rules={AMOUNT}
                        value={army[i] ?? 0}
                        onChange={(count) => onArmy(UNITS.map((_, j) => (j === i ? count : (army[j] ?? 0))))}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
        <AddUnit rest={units.rest} onAdd={units.add} />
        <Paste role="attack" onArmy={(pasted) => onArmy(countsToArmy(pasted))} />
      </CardContent>
    </Card>
  );
}

/** The target's army on its hunting field, pasted as in the extension; unknown, nobody defends. */
export function DefenseCard({
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
    <Card>
      <CardHeader>
        <CardTitle>Sa défense sur le TDC</CardTitle>
        <CardDescription>
          Facultative. Ses niveaux étant inconnus, on prend les vôtres (Armes, Bouclier Thoracique).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span>{known ? armyText(known) : "Inconnue, comptée comme nulle."}</span>
          {known && (
            <Button type="button" variant="link" size="sm" className="px-0" onClick={() => onDefense(null)}>
              Effacer
            </Button>
          )}
        </div>
        <label htmlFor={id} className="block text-sm text-muted-foreground">
          Coller un rapport de combat ou « 300 Jeunes Soldates Naines, 2 Tanks » : son armée sur le TDC
        </label>
        <textarea
          id={id}
          rows={2}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setNothingRead(false);
          }}
          className="w-full min-w-0 border border-input bg-transparent px-2.5 py-1.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
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
      </CardContent>
    </Card>
  );
}
