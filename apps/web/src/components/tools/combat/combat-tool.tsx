"use client";

// The site's combat simulator: both sides, the place attacked, the result recomputed at each change. Its state lives
// in the address (`#p=`), so a battle is shared as a link; the extension's simulator opens it the same way.
// See docs/features/site-combat.md.
import { PLACES, type Place } from "@optizzz/game/army/battle";
import { emptyForm, swapSides, type SimulatorForm } from "@optizzz/game/army/battle-form";
import { combatLinkFormat, type CombatSide, type CombatToolState } from "@optizzz/game/site-links/combat";
import { Button } from "~/components/ui/button";
import { CopyLinkButton } from "../copy-link-button";
import type { MyLevelKey } from "../my-levels";
import { InvalidLinkNote, ToolLayout, ToolNote } from "../tool-page";
import { ResumeLevelsButton, useMyLevels } from "../use-my-levels";
import { useToolState } from "../use-tool-state";
import { chooseMySide, SIDE_LEVELS, withLevels } from "./combat-levels";
import { AttackerSide, DefenderSide } from "./combat-form";
import { CombatResult, PLACE_LABELS } from "./combat-result";

const EMPTY: CombatToolState = { form: emptyForm(), mine: "attack" };

const SIDE_LABELS: Record<CombatSide, string> = { attack: "attaquant", defend: "défenseur" };

const isLevelOf = (side: CombatSide, key: string): key is MyLevelKey =>
  (SIDE_LEVELS[side] as readonly string[]).includes(key);

function Choice<Value extends string>({
  legend,
  name,
  options,
  value,
  onChange,
}: {
  legend: string;
  name: string;
  options: readonly { value: Value; label: string }[];
  value: Value;
  onChange: (value: Value) => void;
}) {
  return (
    <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
      <legend className="float-left mr-2 font-medium">{legend}</legend>
      {options.map((option) => (
        <label key={option.value} className="flex items-center gap-1.5">
          <input
            type="radio"
            name={name}
            className="size-4 accent-primary"
            checked={value === option.value}
            onChange={() => onChange(option.value)}
          />
          {option.label}
        </label>
      ))}
    </fieldset>
  );
}

export function CombatTool() {
  const tool = useToolState({
    tool: "combat",
    format: combatLinkFormat,
    empty: EMPTY,
    withMyLevels: (state, mine) => ({ ...state, form: withLevels(state.form, state.mine, mine) }),
  });
  const levels = useMyLevels(tool);
  const { form, mine } = tool.state;

  const changeForm = (update: (form: SimulatorForm) => SimulatorForm) =>
    tool.change((state) => ({ ...state, form: update(state.form) }));

  /** A level typed on the visitor's side becomes « Mes niveaux » (not over a link's levels). */
  const typedLevel = (side: CombatSide, key: string, value: number) => {
    if (side === mine && isLevelOf(side, key)) levels.remember({ [key]: value });
  };

  return (
    <div className="space-y-4">
      <ToolNote>
        Règles non vérifiées sur un vrai combat entre joueurs (tutoriel officiel, Outiiil, Calystene) : à prendre comme
        une estimation.
      </ToolNote>
      <InvalidLinkNote shown={tool.invalidLink} />
      <ToolLayout
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                tool.change((state) => ({
                  form: swapSides(state.form),
                  mine: state.mine === "attack" ? "defend" : "attack",
                }))
              }
            >
              Échanger
            </Button>
            <ResumeLevelsButton
              levels={levels}
              onResume={(myLevels) =>
                tool.change((state) => ({ ...state, form: withLevels(state.form, state.mine, myLevels) }))
              }
            />
            <CopyLinkButton />
          </>
        }
        form={
          <>
            <div className="space-y-3 border bg-card p-4">
              <Choice<Place>
                legend="Lieu attaqué :"
                name="target"
                value={form.target}
                options={PLACES.map((place) => ({ value: place, label: PLACE_LABELS[place] }))}
                onChange={(target) => changeForm((current) => ({ ...current, target }))}
              />
              <Choice<CombatSide>
                legend="Mes niveaux :"
                name="mine"
                value={mine}
                options={(["attack", "defend"] as const).map((side) => ({ value: side, label: SIDE_LABELS[side] }))}
                onChange={(side) => {
                  // Over a link's levels, « Mes niveaux » wait for « Reprendre mes niveaux ».
                  const myLevels = levels.linked ? null : levels.resume();
                  tool.change((state) => chooseMySide(state, side, myLevels));
                }}
              />
            </div>
            <AttackerSide
              attacker={form.attacker}
              mine={mine === "attack"}
              onNumber={(key, value) => {
                changeForm((current) => ({ ...current, attacker: { ...current.attacker, [key]: value } }));
                typedLevel("attack", key, value);
              }}
              onArmy={(army) => changeForm((current) => ({ ...current, attacker: { ...current.attacker, army } }))}
            />
            <DefenderSide
              defender={form.defender}
              mine={mine === "defend"}
              onNumber={(key, value) => {
                changeForm((current) => ({ ...current, defender: { ...current.defender, [key]: value } }));
                typedLevel("defend", key, value);
              }}
              onArmy={(place, army) =>
                changeForm((current) => ({
                  ...current,
                  defender: { ...current.defender, armies: { ...current.defender.armies, [place]: army } },
                }))
              }
            />
          </>
        }
        resultTitle="Rapport"
        result={<CombatResult form={form} />}
      />
    </div>
  );
}
