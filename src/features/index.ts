import { allianceMapMenu } from "./alliance-map/menu";
import { combatSimulator } from "./combat-simulator";
import { convoyPlanner } from "./convoy";
import { endTimes } from "./end-times";
import type { Feature } from "./feature";
import { floodPlanner } from "./flood";
import { gameLevels } from "./game-levels";
import { huntReports } from "./hunt-reports";
import { layingPlanner } from "./laying-planner";
import { resourceForecast } from "./resource-forecast";
import { settingsMenu } from "./settings";
import { tdcChainMenu } from "./tdc-chain/menu";
import { targets } from "./targets";
import { workQueue } from "./work-queue";

/** Registry of lightweight features, loaded on every page: register each new feature here. */
export const features: Feature[] = [
  settingsMenu,
  allianceMapMenu,
  tdcChainMenu,
  workQueue,
  endTimes,
  resourceForecast,
  huntReports,
  layingPlanner,
  convoyPlanner,
  targets,
  floodPlanner,
  combatSimulator,
  gameLevels,
];
