"use client";

// The costs tool: what a building or a research costs and takes from one level to another, with Architecture or
// Salle d'analyse. See docs/features/site-couts.md.
import { formatCompact, formatNumber } from "@optizzz/game/format/number-format";
import { formatGameDuration } from "@optizzz/game/format/time-format";
import { LEVEL_BASES, type LevelKey } from "@optizzz/game/level-costs";
import { BUILDINGS, RESEARCH } from "@optizzz/game/levels";
import { cn } from "cn";
import { useId } from "react";
import { NumberField } from "~/components/number-field";
import { MonoLabel, Panel } from "~/components/panel";
import { CopyLinkButton } from "../copy-link-button";
import { pickLevels } from "../my-levels";
import { InvalidLinkNote, ToolLayout, Verdict } from "../tool-page";
import { ResumeLevelsButton, useMyLevels } from "../use-my-levels";
import { useToolState } from "../use-tool-state";
import { CostsChart } from "./costs-chart";
import { costsFormat, EMPTY_COSTS, MAX_LEVEL, type CostsState } from "./costs-state";
import { bonusKeyOf, costedResources, developmentPlan, type DevelopmentPlan, type Resource } from "./development";

const BONUS_KEYS = ["architecture", "analysisRoom"] as const;

const BONUS_LABELS = { architecture: "Architecture", analysisRoom: "Salle d’analyse" } as const;

const BONUS_HINTS = {
  architecture: "ôte 10 % à la durée des bâtiments, par niveau",
  analysisRoom: "ôte 10 % à la durée des recherches, par niveau",
} as const;

const RESOURCE_LABELS: Record<Resource, string> = { food: "Nourriture", materials: "Matériaux", workers: "Ouvrières" };

/** The colour of each resource's label; the label names it too (ADR 0003). */
const RESOURCE_TONES: Record<Resource, string> = {
  food: "text-primary",
  materials: "text-info",
  workers: "text-muted-foreground",
};

const LEVEL_RULES = { integer: true, min: 0, max: MAX_LEVEL, allowEmpty: true } as const;

const KINDS = [
  { value: "building", label: "Bâtiments", list: BUILDINGS, field: "Bâtiment" },
  { value: "research", label: "Recherches", list: RESEARCH, field: "Recherche" },
] as const;

type Kind = (typeof KINDS)[number]["value"];

const kindOf = (key: LevelKey): Kind => (BUILDINGS.some((building) => building.key === key) ? "building" : "research");

const nameOf = (key: LevelKey) => [...BUILDINGS, ...RESEARCH].find((entry) => entry.key === key)?.name ?? key;

const duration = (seconds: number) => formatGameDuration(seconds * 1000);

/** What the cumulated cost adds up: food and materials (workers are counted apart). */
const summedOf = (resources: Resource[]) => resources.filter((resource) => resource !== "workers");

const sum = (cost: Record<Resource, number>, resources: Resource[]) =>
  resources.reduce((total, resource) => total + cost[resource], 0);

const FIELD_LABEL = "flex flex-col gap-1 font-mono text-[0.6875rem] tracking-widest text-muted-foreground uppercase";

export function CostsTool() {
  const tool = useToolState<CostsState>({
    tool: "costs",
    format: costsFormat,
    empty: EMPTY_COSTS,
    withMyLevels: (state, mine) => ({ ...state, ...pickLevels(mine, BONUS_KEYS) }),
  });
  const levels = useMyLevels(tool);
  const { state, change } = tool;
  const bonusKey = bonusKeyOf(state.element);
  const kind = KINDS.find((entry) => entry.value === kindOf(state.element)) ?? KINDS[0];
  const ids = { element: useId(), from: useId(), to: useId(), bonus: useId() };

  const from = state.from ?? 0;
  const aimed = state.to !== null && state.to > from;
  const plan = aimed ? developmentPlan(state.element, from, state.to ?? 0, state[bonusKey] ?? 0) : null;
  const resources = costedResources(state.element);

  const form = (
    <>
      <InvalidLinkNote shown={tool.invalidLink} />
      <Panel title="Quoi">
        <div className="space-y-4">
          <Segmented
            label="Bâtiments ou recherches"
            options={KINDS}
            value={kind.value}
            onChange={(value) => {
              if (value === kind.value) return;
              const element = (value === "building" ? BUILDINGS : RESEARCH)[0].key;
              change((current) => ({ ...current, element }));
            }}
          />
          <div className="grid grid-cols-2 gap-3">
            <label htmlFor={ids.element} className={cn(FIELD_LABEL, "col-span-2")}>
              {kind.field}
              <select
                id={ids.element}
                value={state.element}
                onChange={(event) => {
                  const element = event.target.value as LevelKey;
                  change((current) => ({ ...current, element }));
                }}
                className="h-9 w-full border border-input bg-background px-2.5 font-sans text-sm tracking-normal text-foreground normal-case"
              >
                {kind.list.map(({ key, name }) => (
                  <option key={key} value={key}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label htmlFor={ids.from} className={FIELD_LABEL}>
              Du niveau
              <NumberField
                id={ids.from}
                className="h-9 bg-background"
                placeholder="0"
                value={state.from}
                rules={LEVEL_RULES}
                onCommit={(value) => change((current) => ({ ...current, from: value }))}
              />
            </label>
            <label htmlFor={ids.to} className={FIELD_LABEL}>
              Au niveau
              <NumberField
                id={ids.to}
                className="h-9 bg-background"
                value={state.to}
                rules={LEVEL_RULES}
                onCommit={(value) => change((current) => ({ ...current, to: value }))}
              />
            </label>
          </div>
        </div>
      </Panel>
      <Panel
        title="Vos bonus"
        aside={<span className="text-xs text-muted-foreground">pré-rempli avec « Mes niveaux »</span>}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label htmlFor={ids.bonus} className={FIELD_LABEL}>
            {BONUS_LABELS[bonusKey]}
            <NumberField
              id={ids.bonus}
              className="h-9 bg-background"
              placeholder="0"
              value={state[bonusKey]}
              rules={LEVEL_RULES}
              aria-describedby={`${ids.bonus}-hint`}
              onCommit={(value) => {
                levels.remember({ [bonusKey]: value });
                change((current) => ({ ...current, [bonusKey]: value }));
              }}
            />
            <span id={`${ids.bonus}-hint`} className="font-sans text-xs tracking-normal normal-case">
              {BONUS_HINTS[bonusKey]} ; supposé ne pas changer pendant les chantiers
            </span>
          </label>
        </div>
      </Panel>
    </>
  );

  const result = plan ? (
    <Report plan={plan} resources={resources} element={state.element} from={from} to={state.to ?? 0} />
  ) : (
    <p className="text-sm text-muted-foreground">Saisissez un niveau d’arrivée au-dessus du niveau de départ.</p>
  );

  return (
    <ToolLayout
      resultTitle="Rapport"
      actions={
        <>
          <ResumeLevelsButton
            levels={levels}
            onResume={(mine) => change((current) => ({ ...current, ...pickLevels(mine, BONUS_KEYS) }))}
          />
          <CopyLinkButton />
        </>
      }
      form={form}
      result={result}
    />
  );
}

/** One choice among a few buttons; the one chosen is filled and pressed (not told by its colour alone). */
function Segmented<Value extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { value: Value; label: string }[];
  value: Value;
  onChange: (value: Value) => void;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex max-w-full flex-wrap border bg-card">
      {options.map((option) => {
        const chosen = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={chosen}
            onClick={() => onChange(option.value)}
            className={cn(
              "h-9 border-r px-3 text-sm last:border-r-0",
              chosen ? "bg-primary font-semibold text-primary-foreground" : "hover:bg-accent",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function Report({
  plan,
  resources,
  element,
  from,
  to,
}: {
  plan: DevelopmentPlan;
  resources: Resource[];
  element: LevelKey;
  from: number;
  to: number;
}) {
  // × 1.2 and × 1.12 come from Toolzzz and have not been seen in the game yet (docs/research/couts-des-niveaux.md).
  const unchecked = LEVEL_BASES[element].slowdowns.find(({ growth }) => growth < 1.3);
  const levels = to - from;
  const summed = summedOf(resources);
  const what = summed.map((resource) => RESOURCE_LABELS[resource].toLowerCase()).join(" + ");
  const points = plan.rows.map((row) => ({ level: row.level, total: sum(row.totalCost, summed) }));
  return (
    <>
      <Verdict
        title={`${formatCompact(sum(plan.total.cost, summed))} pour ${String(levels)} niveau${levels > 1 ? "x" : ""}`}
      >
        {nameOf(element)} {from} → {to} · {duration(plan.total.seconds)} de chantier
      </Verdict>
      <div className="-mx-4 -mt-4 -mb-4">
        <div className={cn("grid border-b", resources.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
          {resources.map((resource, index) => (
            <div
              key={resource}
              className={cn(
                "min-w-0 px-4 py-3",
                index % 2 === 0 && index < resources.length - 1 && "border-r",
                index >= 2 && "border-t",
              )}
            >
              <MonoLabel className={RESOURCE_TONES[resource]}>{RESOURCE_LABELS[resource]}</MonoLabel>
              <div className="font-mono text-2xl [overflow-wrap:anywhere]">
                {formatNumber(plan.total.cost[resource])}
              </div>
            </div>
          ))}
        </div>
        {points.length > 1 && (
          <figure className="m-0 space-y-3 border-b p-4 pt-3">
            <figcaption className="font-heading text-lg tracking-wide uppercase">
              Coût cumulé{summed.length > 1 && ` (${what})`}, niveau par niveau
            </figcaption>
            <CostsChart points={points} label="Coût cumulé" />
          </figure>
        )}
        {unchecked && to >= unchecked.from && (
          <p className="border-b px-4 py-3 text-sm text-muted-foreground">
            À partir du niveau {unchecked.from}, la croissance des durées (reprise de Toolzzz) n’a pas encore été
            vérifiée dans le jeu.
          </p>
        )}
        <details open>
          <summary className="cursor-pointer px-4 py-2.5 font-heading text-lg tracking-wide uppercase">
            Détail par niveau
          </summary>
          <Detail plan={plan} resources={resources} summed={summed} what={what} />
        </details>
      </div>
    </>
  );
}

const HEAD = "px-1 py-2 text-right font-mono text-[0.6875rem] font-medium tracking-wide whitespace-nowrap uppercase";
const CELL = "px-1 py-1.5 text-right font-mono whitespace-nowrap tabular-nums";

function Detail({
  plan,
  resources,
  summed,
  what,
}: {
  plan: DevelopmentPlan;
  resources: Resource[];
  summed: Resource[];
  what: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs">
        <thead className="text-muted-foreground">
          <tr>
            <th scope="col" className={cn(HEAD, "pl-4 text-left")}>
              Niveau
            </th>
            {resources.map((resource) => (
              <th key={resource} scope="col" className={HEAD}>
                {RESOURCE_LABELS[resource]}
              </th>
            ))}
            <th scope="col" className={HEAD}>
              Durée
            </th>
            <th scope="col" className={cn(HEAD, "pr-4")} title={summed.length > 1 ? `Cumul ${what}` : undefined}>
              Cumulé
            </th>
          </tr>
        </thead>
        <tbody>
          {plan.rows.map((row) => (
            <tr key={row.level} className="border-t">
              <th scope="row" className={cn(CELL, "pl-4 text-left font-normal")}>
                {row.level}
              </th>
              {resources.map((resource) => (
                <td key={resource} className={CELL}>
                  {formatNumber(row.cost[resource])}
                </td>
              ))}
              <td className={CELL}>{duration(row.seconds)}</td>
              <td className={cn(CELL, "pr-4")}>{formatNumber(sum(row.totalCost, summed))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
