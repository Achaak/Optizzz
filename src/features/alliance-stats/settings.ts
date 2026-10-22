import { storage } from "wxt/utils/storage";
import type { AllianceMetric } from "./series";

/** Remembered per server, shared by the view and the box on alliance pages. */
export interface AllianceStatsSettings {
  /** Tags compared with mine. */
  compared: string[];
  /** Days shown, today included; null for every export. */
  days: number | null;
  metric: AllianceMetric;
  /** Per member rather than in total. */
  average: boolean;
  /** The colour of each compared alliance on the charts, by tag: kept while others come and go. */
  colors: Record<string, string>;
}

export const DEFAULT_SETTINGS: AllianceStatsSettings = {
  compared: [],
  days: 14,
  metric: "field",
  average: false,
  colors: {},
};

const key = (host: string) => `local:alliance-stats:${host}:settings` as const;

export async function readAllianceStatsSettings(host: string): Promise<AllianceStatsSettings> {
  const stored = await storage.getItem<Partial<AllianceStatsSettings>>(key(host));
  return { ...DEFAULT_SETTINGS, ...stored };
}

export async function writeAllianceStatsSettings(host: string, settings: AllianceStatsSettings): Promise<void> {
  await storage.setItem(key(host), settings);
}
