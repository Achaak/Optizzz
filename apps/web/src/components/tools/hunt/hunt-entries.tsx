"use client";

// « Vos niveaux » and « Votre armée »: the levels, the field and the army sent, typed or pasted, as the mockup draws
// them. See docs/features/site-chasse.md.
import { readArmyText, type Counts } from "@optizzz/game/army/army-text";
import { unitLabel } from "@optizzz/game/army/units";
import type { NumberFieldRules } from "@optizzz/game/format/number-field";
import type { HuntForm } from "@optizzz/game/hunt/hunt-form";
import { cn } from "cn";
import { useId, useState, type ReactNode } from "react";
import { NumberField } from "~/components/number-field";
import { SmallLabel, Panel } from "~/components/panel";
import { Button } from "~/components/ui/button";
import { NoUnit, UnitName, useShownUnits } from "../unit-rows";
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
  shield: "Bouclier thoracique",
  huntSpeed: "Vitesse de chasse",
  cochineal: "Étable à cochenilles",
};

const LAYING_LEVEL_LABELS: Record<LayingLevelKey, string> = {
  nursery: "Couveuse",
  solarium: "Solarium",
  laying: "Technique de ponte",
};

/** The height of the form's fields, as the mockup. */
export const FIELD_CLASS = "h-9.5";

/** « cm² », « % » inside a field, on the right (the field leaves room with `pr-…`). */
export function Suffix({ children }: { children: ReactNode }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-muted-foreground"
    >
      {children}
    </span>
  );
}

/** A field with its label in small mono capitals above it, and a unit (« cm² », « % ») inside on the right. */
export function LabelledField({
  label,
  suffix,
  children,
  className,
}: {
  label: string;
  suffix?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block min-w-0 space-y-1", className)}>
      <SmallLabel className="block">{label}</SmallLabel>
      <span className="relative block">
        {children}
        {suffix && <Suffix>{suffix}</Suffix>}
      </span>
    </label>
  );
}

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
    <LabelledField label={label}>
      <NumberField
        aria-label={label}
        placeholder="à remplir"
        className={FIELD_CLASS}
        value={value}
        onCommit={onChange}
        rules={LEVEL}
      />
    </LabelledField>
  );
}

/** « Vos niveaux »: the four levels the plan needs and the field, then the laying levels (optional). */
export function HuntLevels({
  form,
  aside,
  onLevel,
  onLayingLevel,
  onLaunchField,
}: {
  form: HuntForm;
  /** « Reprendre mes niveaux », when the extension is linked. */
  aside?: ReactNode;
  onLevel: (key: HuntLevelKey, value: number | null) => void;
  onLayingLevel: (key: LayingLevelKey, value: number | null) => void;
  onLaunchField: (value: number | null) => void;
}) {
  const layingId = useId();
  return (
    <Panel
      title="Vos niveaux"
      aside={
        <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          depuis « Mes niveaux » de l&apos;extension
          {aside}
        </span>
      }
      flush
    >
      <div className="grid grid-cols-2 gap-3 px-4 py-3.5">
        {(Object.keys(HUNT_LEVEL_LABELS) as HuntLevelKey[]).map((key) => (
          <LevelField
            key={key}
            label={HUNT_LEVEL_LABELS[key]}
            value={form.levels[key]}
            onChange={(value) => onLevel(key, value)}
          />
        ))}
        <LabelledField label="Votre TDC" suffix="cm²">
          <NumberField
            aria-label="Votre TDC au lancement, en cm²"
            placeholder="à remplir"
            className={cn(FIELD_CLASS, "pr-11")}
            value={form.launchField}
            onCommit={onLaunchField}
            rules={{ ...AMOUNT, min: 1 }}
          />
        </LabelledField>
      </div>
      <div role="group" aria-labelledby={layingId} className="space-y-2 border-t px-4 py-3.5">
        <p id={layingId} className="text-sm">
          Vitesse de ponte{" "}
          <span className="text-muted-foreground">(facultatif) : pour voir les pertes en temps de ponte</span>
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
      </div>
    </Panel>
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
        Une liste « 2 000 JSN, 300 SN » ou les troupes d&apos;un rapport
      </label>
      <textarea
        id={id}
        rows={2}
        value={text}
        onChange={(event) => setText(event.target.value)}
        className="w-full min-w-0 border border-input bg-transparent px-2.5 py-1.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30 rounded-lg"
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

/** « Votre armée »: one row per unit with a count, « + Unité » and « Coller l'armée du jeu » across the foot. */
export function HuntArmy({ form, onArmy }: { form: HuntForm; onArmy: (army: Counts) => void }) {
  const units = useShownUnits((unit) => (form.army[unit.key] ?? 0) > 0);
  const titleId = useId();
  const pasteId = useId();
  const [pasting, setPasting] = useState(false);
  return (
    <section
      aria-labelledby={titleId}
      className="flex min-w-0 flex-col rounded-[0.875rem] bg-card text-card-foreground shadow-panel"
    >
      <header className="px-4.5 pt-4 pb-1.5">
        <h2 id={titleId} className="font-heading text-xl font-semibold tracking-wide uppercase">
          Votre armée
        </h2>
      </header>
      <div className="px-4 py-2.5">
        {units.shown.length === 0 ? (
          <NoUnit />
        ) : (
          <div className="space-y-1.5">
            {units.shown.map((unit) => (
              <label key={unit.key} className="grid grid-cols-[minmax(0,1fr)_8rem] items-center gap-2">
                <UnitName unit={unit} />
                <NumberField
                  aria-label={unit.name}
                  placeholder="0"
                  className="h-9 w-full min-w-0 text-right tabular-nums"
                  rules={AMOUNT}
                  value={(form.army[unit.key] ?? 0) === 0 ? null : (form.army[unit.key] ?? null)}
                  onCommit={(count) => onArmy({ ...form.army, [unit.key]: count ?? 0 })}
                />
              </label>
            ))}
          </div>
        )}
      </div>
      {pasting && (
        <div id={pasteId} className="border-t px-4 py-3">
          <Paste onArmy={onArmy} />
        </div>
      )}
      <div className="flex border-t">
        {units.rest.length > 0 && (
          <select
            aria-label="Ajouter une unité"
            value=""
            onChange={(event) => {
              if (event.target.value) units.add(event.target.value);
            }}
            className="h-10 min-w-0 flex-1 cursor-pointer appearance-none border-r bg-transparent px-2 text-sm [text-align-last:center] hover:bg-accent"
          >
            <option value="">+ Unité</option>
            {units.rest.map((unit) => (
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
