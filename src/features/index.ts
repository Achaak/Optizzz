import { alerts } from "./alerts";
import { collect } from "./collect";
import { allianceMapMenu } from "./alliance-map/menu";
import { allianceSharingMenu } from "./alliance-sharing/menu";
import { allianceStatsMenu } from "./alliance-stats/menu";
import { attacksOnWay } from "./attacks-on-way";
import { combatSimulator } from "./combat-simulator";
import { convoyPlanner, convoyWorkers } from "./convoy";
import { endTimes } from "./end-times";
import type { Feature } from "./feature";
import { floodPlanner } from "./flood";
import { gameLevels } from "./game-levels";
import { historyMenu } from "./history/menu";
import { huntReports } from "./hunt-reports";
import { layingPlanner } from "./laying-planner";
import { membersColumns } from "./members-columns";
import { probes } from "./probes";
import { profileProduction } from "./profile-production";
import { researchAdviceFeature, speedUpAdvice } from "./research-advice";
import { resourceForecast } from "./resource-forecast";
import { safeReload } from "./safe-reload";
import { serverMap } from "./server-map";
import { settingsMenu } from "./settings";
import { tdcChainMenu } from "./tdc-chain/menu";
import { targets } from "./targets";
import { watchlist } from "./watchlist";
import { workQueue } from "./work-queue";

/** Registry of lightweight features, loaded on every page: register each new feature here. */
export const features: Feature[] = [
  settingsMenu,
  // First: the others may read what it keeps.
  collect,
  allianceMapMenu,
  tdcChainMenu,
  historyMenu,
  allianceStatsMenu,
  allianceSharingMenu,
  workQueue,
  endTimes,
  resourceForecast,
  alerts,
  huntReports,
  layingPlanner,
  convoyPlanner,
  convoyWorkers,
  targets,
  membersColumns,
  profileProduction,
  floodPlanner,
  researchAdviceFeature,
  speedUpAdvice,
  attacksOnWay,
  probes,
  combatSimulator,
  serverMap,
  watchlist,
  gameLevels,
  safeReload,
];
