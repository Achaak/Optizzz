import { allianceMapMenu } from "./alliance-map/menu";
import { combatSimulator } from "./combat-simulator";
import { endTimes } from "./end-times";
import type { Feature } from "./feature";
import { gameLevels } from "./game-levels";
import { huntReports } from "./hunt-reports";
import { layingPlanner } from "./laying-planner";
import { resourceForecast } from "./resource-forecast";
import { settingsMenu } from "./settings";
import { workQueue } from "./work-queue";

/** Registry of lightweight features, loaded on every page: register each new feature here. */
export const features: Feature[] = [
  settingsMenu,
  allianceMapMenu,
  workQueue,
  endTimes,
  resourceForecast,
  huntReports,
  layingPlanner,
  combatSimulator,
  gameLevels,
];
