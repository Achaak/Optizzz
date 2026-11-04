"use client";

// The site's flood simulator: the attacks that take the most hunting field from a target, as the extension's
// « Plan de flood » (same plan, @optizzz/game/site-links/flood). Fields typed by hand, or taken from players chosen on
// a server, with the trip if launched now. Its state lives in the address (`#p=`); the extension opens it the same
// way. See docs/features/site-flood.md.
import { EMPTY_FLOOD, floodLinkFormat, floodToolPlan, type FloodToolState } from "@optizzz/game/site-links/flood";
import { FLOOD_MARGIN } from "@optizzz/game/flood";
import { formatNumber } from "@optizzz/game/format/number-format";
import { Panel, PanelLink } from "~/components/panel";
import { guidePath } from "~/lib/guides/guides";
import { CopyLinkButton } from "../copy-link-button";
import { pickLevels, type MyLevels } from "../my-levels";
import { PlayerPicker, ServerSelect, usePickedPlayer, type PickedEnd } from "../player-picker";
import { InvalidLinkNote, ToolLayout, ToolNote } from "../tool-page";
import { endPoint, travelResult } from "../travel/travel-result";
import { useNow } from "../travel/travel-tool";
import { ResumeLevelsButton, useMyLevels } from "../use-my-levels";
import { useToolState } from "../use-tool-state";
import { ArmyPanel, DefenseField, Fields, LevelsPanel, type FloodLevelKey } from "./flood-form";
import { FloodResult, type Trip } from "./flood-result";

const LEVEL_KEYS = ["attackSpeed", "weapons", "shield"] as const satisfies readonly FloodLevelKey[];

/** « Mes niveaux » in the level fields; a level they do not know stays as it was. */
const withLevels = (state: FloodToolState, mine: MyLevels): FloodToolState => {
  const picked = pickLevels(mine, LEVEL_KEYS);
  return {
    ...state,
    attackSpeed: picked.attackSpeed ?? state.attackSpeed,
    weapons: picked.weapons ?? state.weapons,
    shield: picked.shield ?? state.shield,
  };
};

/** A player of another server is not one of this server: only the positions stay. */
function withServer(state: FloodToolState, server: string | null): FloodToolState {
  if (server === state.server) return state;
  const kept = (end: PickedEnd | null) => (end?.kind === "player" ? null : end);
  return { ...state, server, attacker: kept(state.attacker), target: kept(state.target) };
}

export function FloodTool() {
  const tool = useToolState({ tool: "flood", format: floodLinkFormat, empty: EMPTY_FLOOD, withMyLevels: withLevels });
  const levels = useMyLevels(tool);
  const { state, change } = tool;
  const now = useNow();
  const attacker = usePickedPlayer(state.server, state.attacker);
  const target = usePickedPlayer(state.server, state.target);

  const from = endPoint(state.attacker, attacker);
  const to = endPoint(state.target, target);
  const trip: Trip | null =
    from && to && state.attackSpeed !== null && now
      ? travelResult({ from, to, attackSpeed: state.attackSpeed, departure: now, now })
      : null;

  const form = (
    <>
      <InvalidLinkNote shown={tool.invalidLink} />
      <Panel title="Vous et la cible">
        <div className="space-y-4">
          <ServerSelect value={state.server} onChange={(server) => change((current) => withServer(current, server))} />
          {/* A new opening (a link pasted in the tab) remounts the pickers: each shows its end. */}
          <PlayerPicker
            key={`attacker-${String(tool.opening)}`}
            label="Vous (attaquant)"
            server={state.server}
            value={state.attacker}
            onChange={(end, player) =>
              change((current) => ({
                ...current,
                attacker: end,
                attackerField: player ? player.field : current.attackerField,
              }))
            }
          />
          <PlayerPicker
            key={`target-${String(tool.opening)}`}
            label="Cible"
            server={state.server}
            value={state.target}
            onChange={(end, player) =>
              change((current) => ({
                ...current,
                target: end,
                targetField: player ? player.field : current.targetField,
              }))
            }
          />
          <Fields
            state={state}
            onChange={(key, value) => change((current) => ({ ...current, [key]: value }))}
            onUnderWay={(underWay) => change((current) => ({ ...current, underWay }))}
          />
          <DefenseField
            defense={state.defense}
            onDefense={(defense) => change((current) => ({ ...current, defense }))}
          />
        </div>
      </Panel>
      <ArmyPanel army={state.army} onArmy={(army) => change((current) => ({ ...current, army }))} />
      <LevelsPanel
        state={state}
        onLevel={(key, value) => {
          change((current) => ({ ...current, [key]: value }));
          levels.remember({ [key]: value });
        }}
        aside={
          <ResumeLevelsButton
            levels={levels}
            onResume={(mine) =>
              change((current) => ({
                ...current,
                attackSpeed: mine.attackSpeed ?? null,
                weapons: mine.weapons ?? null,
                shield: mine.shield ?? null,
              }))
            }
          />
        }
      />
      <ToolNote>
        Règles pas encore vérifiées sur un vrai flood : à prendre comme une estimation. Pour faire monter le TDC de
        toute une alliance : <PanelLink href={guidePath("tdc-chain")}>le guide de la chaîne de TDC</PanelLink>
      </ToolNote>
      <details className="text-sm text-muted-foreground">
        <summary className="cursor-pointer">Règles utilisées</summary>
        <p className="mt-2">
          20 % de son TDC par attaque, 1 cm² par fourmi au plus, portée 50–300 % revérifiée à chaque arrivée, avec{" "}
          {formatNumber(FLOOD_MARGIN * 100)} % de marge au-dessus de 50 %. Vitesse d&apos;attaque + 1 attaques en même
          temps (comme le simulateur de flood du jeu). Sans défense, les unités les moins chères partent d&apos;abord ;
          contre une défense, la première attaque est la plus petite armée, des plus fortes aux plus faibles, qui gagne
          avec une riposte à 10 % au plus. Les attaques et chasses des autres joueurs peuvent changer les TDC avant
          l&apos;arrivée.
        </p>
      </details>
    </>
  );

  return (
    <ToolLayout
      actions={<CopyLinkButton />}
      form={form}
      resultTitle="Plan de flood"
      result={<FloodResult plan={floodToolPlan(state)} targetName={target?.pseudo ?? "La cible"} trip={trip} />}
    />
  );
}
