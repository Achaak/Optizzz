"use client";

// « Vos données »: the levels, the field and the army sent, typed or pasted. See docs/features/site-chasse.md.
import { readArmyText, type Counts } from "@optizzz/game/army/army-text";
import type { NumberFieldRules } from "@optizzz/game/format/number-field";
import type { HuntForm } from "@optizzz/game/hunt/hunt-form";
import { useId, useState } from "react";
import { NumberField } from "~/components/number-field";
import { Button } from "~/components/ui/button";
import { AddUnit, NoUnit, UnitName, useShownUnits } from "../unit-rows";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import type { HuntLevelKey, LayingLevelKey } from "./hunt-settings";

export const LEVEL: NumberFieldRules = { min: 0, max: 1000, integer: true, allowEmpty: true };
export const AMOUNT: NumberFieldRules = {
  min: 0,
  max: Number.MAX_SAFE_INTEGER,
  integer: true,
  amount: true,
  allowEmpty: true,
};

const HUNT_LEVEL_LABELS: Record<HuntLevelKey, string> = {
  weapons: "Armes",
  shield: "Bouclier Thoracique",
  huntSpeed: "Vitesse de chasse",
  cochineal: "Étable à cochenilles",
};

const LAYING_LEVEL_LABELS: Record<LayingLevelKey, string> = {
  nursery: "Couveuse",
  solarium: "Solarium",
  laying: "Technique de ponte",
};

function LevelField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  return (
    <label className="space-y-1 text-sm">
      <span className="block font-mono text-[0.6875rem] tracking-widest text-muted-foreground uppercase">{label}</span>
      <NumberField aria-label={label} placeholder="à remplir" value={value} onCommit={onChange} rules={LEVEL} />
    </label>
  );
}

/** A pasted report (« Troupes en attaque : … ») or a « 2 000 JSN, 300 SN » list fills the army. */
function Paste({ onArmy }: { onArmy: (army: Counts) => void }) {
  const id = useId();
  const [text, setText] = useState("");
  const [unknown, setUnknown] = useState<string[]>([]);
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm text-muted-foreground">
        Coller une armée : une liste « 2 000 JSN, 300 SN » ou les troupes d&apos;un rapport
      </label>
      <textarea
        id={id}
        rows={2}
        value={text}
        onChange={(event) => setText(event.target.value)}
        className="w-full min-w-0 border border-input bg-transparent px-2.5 py-1.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!text.trim()}
        onClick={() => {
          const read = readArmyText(text, "attack");
          onArmy(read.army);
          setUnknown(read.unknown);
        }}
      >
        Remplir
      </Button>
      {unknown.length > 0 && (
        <p role="status" className="text-sm text-muted-foreground">
          Unités inconnues ignorées : {unknown.join(", ")}
        </p>
      )}
    </div>
  );
}

export function HuntEntries({
  form,
  onLevel,
  onLayingLevel,
  onLaunchField,
  onArmy,
}: {
  form: HuntForm;
  onLevel: (key: HuntLevelKey, value: number | null) => void;
  onLayingLevel: (key: LayingLevelKey, value: number | null) => void;
  onLaunchField: (value: number | null) => void;
  onArmy: (army: Counts) => void;
}) {
  const units = useShownUnits((unit) => (form.army[unit.key] ?? 0) > 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Vos données</CardTitle>
        <CardDescription>« Mes niveaux » remplissent les niveaux ; un niveau manquant reste à remplir.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(Object.keys(HUNT_LEVEL_LABELS) as HuntLevelKey[]).map((key) => (
            <LevelField
              key={key}
              label={HUNT_LEVEL_LABELS[key]}
              value={form.levels[key]}
              onChange={(value) => onLevel(key, value)}
            />
          ))}
        </div>
        <label className="block max-w-xs space-y-1 text-sm">
          <span className="block font-mono text-[0.6875rem] tracking-widest text-muted-foreground uppercase">
            TDC au lancement (cm²)
          </span>
          <NumberField
            aria-label="TDC au lancement"
            placeholder="à remplir"
            value={form.launchField}
            onCommit={onLaunchField}
            rules={{ ...AMOUNT, min: 1 }}
          />
        </label>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Vitesse de ponte (facultatif)</legend>
          <p className="text-sm text-muted-foreground">
            Avec ces trois niveaux, les pertes sont aussi données en temps de ponte.
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {(Object.keys(LAYING_LEVEL_LABELS) as LayingLevelKey[]).map((key) => (
              <LevelField
                key={key}
                label={LAYING_LEVEL_LABELS[key]}
                value={form.laying[key]}
                onChange={(value) => onLayingLevel(key, value)}
              />
            ))}
          </div>
        </fieldset>
        <div className="space-y-2">
          <h3 className="font-mono text-[0.6875rem] tracking-widest text-muted-foreground uppercase">Armée envoyée</h3>
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
                      <NumberField
                        aria-label={unit.name}
                        placeholder="0"
                        className="ml-auto w-28 min-w-28 text-right tabular-nums"
                        rules={AMOUNT}
                        value={(form.army[unit.key] ?? 0) === 0 ? null : (form.army[unit.key] ?? null)}
                        onCommit={(count) => onArmy({ ...form.army, [unit.key]: count ?? 0 })}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <AddUnit rest={units.rest} onAdd={units.add} />
        </div>
        <Paste onArmy={onArmy} />
      </CardContent>
    </Card>
  );
}
