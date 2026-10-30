"use client";

// The site's flood simulator: the attacks that take the most hunting field from a target, as the extension's
// « Plan de flood » (same plan, @optizzz/game/site-links/flood). Fields typed by hand, or taken from players chosen on
// a server, with the trip if launched now. Its state lives in the address (`#p=`); the extension opens it the same
// way. See docs/features/site-flood.md.
import { EMPTY_FLOOD, floodLinkFormat, floodToolPlan, type FloodToolState } from "@optizzz/game/site-links/flood";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { CopyLinkButton } from "../copy-link-button";
import { pickLevels, type MyLevels } from "../my-levels";
import { PlayerPicker, ServerSelect, usePickedPlayer, type PickedEnd } from "../player-picker";
import { InvalidLinkNote, ToolLayout } from "../tool-page";
import { endPoint, travelResult } from "../travel/travel-result";
import { useNow } from "../travel/travel-tool";
import { ResumeLevelsButton, useMyLevels } from "../use-my-levels";
import { useToolState } from "../use-tool-state";
import { ArmyCard, DefenseCard, Fields, LevelsCard, type FloodLevelKey } from "./flood-form";
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
      <Card>
        <CardHeader>
          <CardTitle>Vous et la cible</CardTitle>
          <CardDescription>
            Les TDC à la main, ou par pseudo sur un serveur : repris du dernier relevé du site, modifiables. Les
            positions donnent le trajet.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
          <Fields state={state} onChange={(key, value) => change((current) => ({ ...current, [key]: value }))} />
        </CardContent>
      </Card>
      <LevelsCard
        state={state}
        onLevel={(key, value) => {
          change((current) => ({ ...current, [key]: value }));
          levels.remember({ [key]: value });
        }}
        onUnderWay={(underWay) => change((current) => ({ ...current, underWay }))}
      />
      <ArmyCard army={state.army} onArmy={(army) => change((current) => ({ ...current, army }))} />
      <DefenseCard defense={state.defense} onDefense={(defense) => change((current) => ({ ...current, defense }))} />
    </>
  );

  return (
    <ToolLayout
      actions={
        <>
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
          <CopyLinkButton />
        </>
      }
      form={form}
      resultTitle="Plan de flood"
      result={<FloodResult plan={floodToolPlan(state)} targetName={target?.pseudo ?? "La cible"} trip={trip} />}
    />
  );
}
