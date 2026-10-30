"use client";

// The costs tool: what a building or a research costs and takes from one level to another, with Architecture or
// Salle d'analyse. See docs/features/site-couts.md.
import { formatNumber } from "@optizzz/game/format/number-format";
import { formatGameDuration } from "@optizzz/game/format/time-format";
import { LEVEL_BASES, type LevelKey } from "@optizzz/game/level-costs";
import { BUILDINGS, RESEARCH } from "@optizzz/game/levels";
import { useId } from "react";
import { NumberField } from "~/components/number-field";
import { Panel } from "~/components/panel";
import { Stat } from "~/components/stat";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { CopyLinkButton } from "../copy-link-button";
import { pickLevels } from "../my-levels";
import { InvalidLinkNote, ToolLayout, Verdict } from "../tool-page";
import { ResumeLevelsButton, useMyLevels } from "../use-my-levels";
import { useToolState } from "../use-tool-state";
import { CostsChart } from "./costs-chart";
import { costsFormat, EMPTY_COSTS, MAX_LEVEL, type CostsState } from "./costs-state";
import { bonusKeyOf, costedResources, developmentPlan, type DevelopmentPlan, type Resource } from "./development";

const BONUS_KEYS = ["architecture", "analysisRoom"] as const;

const BONUS_LABELS = { architecture: "Niveau d’Architecture", analysisRoom: "Niveau de Salle d’analyse" } as const;

const BONUS_PHRASES = {
  architecture: "Chaque niveau d’Architecture",
  analysisRoom: "Chaque niveau de Salle d’analyse",
} as const;

const RESOURCE_LABELS: Record<Resource, string> = { food: "Nourriture", materials: "Matériaux", workers: "Ouvrières" };

const LEVEL_RULES = { integer: true, min: 0, max: MAX_LEVEL, allowEmpty: true } as const;

const nameOf = (key: LevelKey) => [...BUILDINGS, ...RESEARCH].find((entry) => entry.key === key)?.name ?? key;

const duration = (seconds: number) => formatGameDuration(seconds * 1000);

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
  const ids = { element: useId(), from: useId(), to: useId(), bonus: useId() };

  const from = state.from ?? 0;
  const aimed = state.to !== null && state.to > from;
  const plan = aimed ? developmentPlan(state.element, from, state.to ?? 0, state[bonusKey] ?? 0) : null;
  const resources = costedResources(state.element);

  const form = (
    <>
      <InvalidLinkNote shown={tool.invalidLink} />
      <Panel title="Bâtiment ou recherche">
        <div className="space-y-4">
          <div className="space-y-1 text-sm">
            <label htmlFor={ids.element} className="block">
              Bâtiment ou recherche
            </label>
            <select
              id={ids.element}
              value={state.element}
              onChange={(event) => {
                const element = event.target.value as LevelKey;
                change((current) => ({ ...current, element }));
              }}
              className="block h-8 w-full max-w-80 rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30"
            >
              <optgroup label="Bâtiments">
                {BUILDINGS.map(({ key, name }) => (
                  <option key={key} value={key}>
                    {name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Recherches">
                {RESEARCH.map(({ key, name }) => (
                  <option key={key} value={key}>
                    {name}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>
          <div className="flex flex-wrap gap-4">
            <div className="space-y-1 text-sm">
              <label htmlFor={ids.from} className="block">
                Niveau actuel
              </label>
              <NumberField
                id={ids.from}
                className="w-24"
                placeholder="0"
                value={state.from}
                rules={LEVEL_RULES}
                onCommit={(value) => change((current) => ({ ...current, from: value }))}
              />
            </div>
            <div className="space-y-1 text-sm">
              <label htmlFor={ids.to} className="block">
                Niveau visé
              </label>
              <NumberField
                id={ids.to}
                className="w-24"
                value={state.to}
                rules={LEVEL_RULES}
                onCommit={(value) => change((current) => ({ ...current, to: value }))}
              />
            </div>
            <div className="space-y-1 text-sm">
              <label htmlFor={ids.bonus} className="block">
                {BONUS_LABELS[bonusKey]}
              </label>
              <NumberField
                id={ids.bonus}
                className="w-24"
                placeholder="0"
                value={state[bonusKey]}
                rules={LEVEL_RULES}
                aria-describedby={`${ids.bonus}-hint`}
                onCommit={(value) => {
                  levels.remember({ [bonusKey]: value });
                  change((current) => ({ ...current, [bonusKey]: value }));
                }}
              />
            </div>
          </div>
          <p id={`${ids.bonus}-hint`} className="text-sm text-muted-foreground">
            {BONUS_PHRASES[bonusKey]} ôte 10 % à la durée ; votre niveau est supposé ne pas changer pendant les
            chantiers.
          </p>
        </div>
      </Panel>
    </>
  );

  const result = plan ? (
    <Total plan={plan} resources={resources} element={state.element} from={from} to={state.to ?? 0} />
  ) : (
    <p className="text-sm text-muted-foreground">Saisissez un niveau visé au-dessus du niveau actuel.</p>
  );

  return (
    <div className="space-y-6">
      <ToolLayout
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
      {plan && <Detail plan={plan} resources={resources} />}
    </div>
  );
}

function Total({
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
  return (
    <>
      <Verdict title={`${String(levels)} niveau${levels > 1 ? "x" : ""}`}>
        {nameOf(element)} : du niveau {from} au niveau {to}, {duration(plan.total.seconds)} de chantier
      </Verdict>
      <div className="grid border-t border-l">
        {resources.map((resource) => (
          <Stat key={resource} label={RESOURCE_LABELS[resource]} value={formatNumber(plan.total.cost[resource])} />
        ))}
        <Stat label="Durée" value={duration(plan.total.seconds)} />
      </div>
      <figure className="m-0 space-y-2">
        <figcaption className="font-heading text-lg font-semibold tracking-wide uppercase">
          Coût cumulé, niveau par niveau
        </figcaption>
        <CostsChart plan={plan} resources={resources} labels={RESOURCE_LABELS} />
      </figure>
      {unchecked && to >= unchecked.from && (
        <p className="text-sm text-muted-foreground">
          À partir du niveau {unchecked.from}, la croissance des durées (reprise de Toolzzz) n’a pas encore été vérifiée
          dans le jeu.
        </p>
      )}
    </>
  );
}

function Detail({ plan, resources }: { plan: DevelopmentPlan; resources: Resource[] }) {
  const span = resources.length + 1;
  return (
    <Panel flush title="Détail par niveau" labelledBy="costs-detail">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead />
            <TableHead colSpan={span} scope="colgroup" className="border-l text-center">
              Ce niveau
            </TableHead>
            <TableHead colSpan={span} scope="colgroup" className="border-l text-center">
              Cumul
            </TableHead>
          </TableRow>
          <TableRow>
            <TableHead scope="col">Niveau</TableHead>
            {[0, 1].map((group) => (
              <Columns key={group} resources={resources} />
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {plan.rows.map((row) => (
            <TableRow key={row.level}>
              <TableHead scope="row" className="tabular-nums">
                {row.level}
              </TableHead>
              {resources.map((resource, index) => (
                <TableCell key={resource} className={`text-right tabular-nums ${index === 0 ? "border-l" : ""}`}>
                  {formatNumber(row.cost[resource])}
                </TableCell>
              ))}
              <TableCell className="text-right tabular-nums">{duration(row.seconds)}</TableCell>
              {resources.map((resource, index) => (
                <TableCell key={resource} className={`text-right tabular-nums ${index === 0 ? "border-l" : ""}`}>
                  {formatNumber(row.totalCost[resource])}
                </TableCell>
              ))}
              <TableCell className="text-right tabular-nums">{duration(row.totalSeconds)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Panel>
  );
}

function Columns({ resources }: { resources: Resource[] }) {
  return (
    <>
      {resources.map((resource, index) => (
        <TableHead key={resource} scope="col" className={`text-right ${index === 0 ? "border-l" : ""}`}>
          {RESOURCE_LABELS[resource]}
        </TableHead>
      ))}
      <TableHead scope="col" className="text-right">
        Durée
      </TableHead>
    </>
  );
}
