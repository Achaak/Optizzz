import { allianceMapMenu } from "./alliance-map/menu";
import type { Feature } from "./feature";

/** Registry of lightweight features, loaded on every page: register each new feature here. */
export const features: Feature[] = [allianceMapMenu];
