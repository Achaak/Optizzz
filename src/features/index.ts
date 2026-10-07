import { allianceMapMenu } from "./alliance-map/menu";
import { endTimes } from "./end-times";
import type { Feature } from "./feature";
import { resourceForecast } from "./resource-forecast";
import { settingsMenu } from "./settings";
import { workQueue } from "./work-queue";

/** Registry of lightweight features, loaded on every page: register each new feature here. */
export const features: Feature[] = [settingsMenu, allianceMapMenu, workQueue, endTimes, resourceForecast];
