"use client";

// The two sides of the combat simulator: levels, army (by place for the defender), and an army pasted as text.
// See docs/features/site-combat.md.
import { readArmyText, type Counts } from "@optizzz/game/army/army-text";
import { PLACES, type Place } from "@optizzz/game/army/battle";
import type { AttackerForm, DefenderForm } from "@optizzz/game/army/battle-form";

import type { NumberFieldRules } from "@optizzz/game/format/number-field";
import { useId, useState, type ReactNode } from "react";
import { NumberField } from "~/components/number-field";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { AddUnit, NoUnit, UnitName, useShownUnits } from "../unit-rows";
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
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {fields.map((field) => (
        <label key={field.key} className="space-y-1 text-sm">
          <span className="block font-mono text-[0.6875rem] tracking-widest text-muted-foreground uppercase">
            {field.label}
          </span>
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
        className="w-full min-w-0 border border-input bg-transparent px-2.5 py-1.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
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

const COUNT_CLASS = "w-28 min-w-24 text-right tabular-nums";

export function AttackerSide({
  attacker,
  mine,
  onNumber,
  onArmy,
}: {
  attacker: AttackerForm;
  mine: boolean;
  onNumber: (key: AttackerNumber, value: number) => void;
  onArmy: (army: Counts) => void;
}) {
  const units = useShownUnits((unit) => (attacker.army[unit.key] ?? 0) > 0);
  return (
    <Card style={{ borderTop: "3px solid var(--primary)" }}>
      <CardHeader>
        <CardTitle className="text-primary">◀ Attaquant</CardTitle>
        {mine && <CardDescription>Votre côté : « Mes niveaux » le remplissent.</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-4">
        <Levels fields={ATTACKER_LEVELS} values={attacker} onChange={onNumber} />
        {units.shown.length === 0 ? (
          <NoUnit />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Unité</TableHead>
                <TableHead className="text-right">Envoyées</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {units.shown.map((unit) => (
                <TableRow key={unit.key}>
                  <TableCell>
                    <UnitName unit={unit} />
                  </TableCell>
                  <TableCell className="text-right">
                    <CountField
                      label={unit.name}
                      className={`${COUNT_CLASS} ml-auto`}
                      rules={AMOUNT}
                      value={attacker.army[unit.key] ?? 0}
                      onChange={(count) => onArmy({ ...attacker.army, [unit.key]: count })}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <AddUnit rest={units.rest} onAdd={units.add} />
        <Paste role="attack" onArmy={onArmy} />
      </CardContent>
    </Card>
  );
}

export function DefenderSide({
  defender,
  mine,
  onNumber,
  onArmy,
}: {
  defender: DefenderForm;
  mine: boolean;
  onNumber: (key: DefenderNumber, value: number) => void;
  onArmy: (place: Place, army: Counts) => void;
}) {
  const [pastePlace, setPastePlace] = useState<Place>("field");
  const units = useShownUnits((unit) => PLACES.some((place) => (defender.armies[place][unit.key] ?? 0) > 0));
  return (
    <Card style={{ borderTop: "3px solid var(--info)" }}>
      <CardHeader>
        <CardTitle className="text-info">Défenseur ▶</CardTitle>
        {mine && <CardDescription>Votre côté : « Mes niveaux » le remplissent.</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-4">
        <Levels fields={DEFENDER_LEVELS} values={defender} onChange={onNumber} />
        {units.shown.length === 0 ? (
          <NoUnit />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Unité</TableHead>
                {PLACES.map((place) => (
                  <TableHead key={place} className="text-right">
                    {PLACE_LABELS[place]}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {units.shown.map((unit) => (
                <TableRow key={unit.key}>
                  <TableCell>
                    <UnitName unit={unit} />
                  </TableCell>
                  {PLACES.map((place) => (
                    <TableCell key={place} className="text-right">
                      <CountField
                        label={`${unit.name}, ${PLACE_LABELS[place]}`}
                        className={`${COUNT_CLASS} ml-auto`}
                        rules={AMOUNT}
                        value={defender.armies[place][unit.key] ?? 0}
                        onChange={(count) => onArmy(place, { ...defender.armies[place], [unit.key]: count })}
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <AddUnit rest={units.rest} onAdd={units.add} />
        <Paste
          role="defense"
          onArmy={(army) => onArmy(pastePlace, army)}
          extra={
            <label className="flex items-center gap-2 text-sm">
              Lieu :
              <select
                value={pastePlace}
                onChange={(event) => setPastePlace(event.target.value as Place)}
                className="h-8 border border-input bg-transparent px-2 text-sm dark:bg-input/30"
              >
                {PLACES.map((place) => (
                  <option key={place} value={place}>
                    {PLACE_LABELS[place]}
                  </option>
                ))}
              </select>
            </label>
          }
        />
      </CardContent>
    </Card>
  );
}
