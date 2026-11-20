import { storage } from "wxt/utils/storage";
import type { RecruitFilters } from "@optizzz/game/analysis/recruits";

/** The filters of the « Recrutement » view, remembered per server. */
const DEFAULT_FILTERS: RecruitFilters = {
  minField: null,
  maxField: null,
  maxDistance: null,
  minBuilding: null,
  maxBuilding: null,
  minTechnology: null,
  maxTechnology: null,
};

const key = (host: string) => `local:recruitment:${host}:filters` as const;

export async function readRecruitFilters(host: string): Promise<RecruitFilters> {
  return { ...DEFAULT_FILTERS, ...(await storage.getItem<Partial<RecruitFilters>>(key(host))) };
}

export async function writeRecruitFilters(host: string, filters: RecruitFilters): Promise<void> {
  await storage.setItem(key(host), filters);
}
