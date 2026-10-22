import { storage } from "wxt/utils/storage";
import type { Metric } from "./series";

/** Remembered per server in the browser. */
export interface HistorySettings {
  /** Players drawn in the alliance view, by id; empty means only me. */
  selected: number[];
  showAverage: boolean;
  /** Days shown, today included; null for every export. */
  days: number | null;
  metric: Metric;
}

export const DEFAULT_SETTINGS: HistorySettings = { selected: [], showAverage: false, days: 14, metric: "field" };

const key = (host: string) => `local:history:${host}:settings` as const;

export async function readHistorySettings(host: string): Promise<HistorySettings> {
  const stored = await storage.getItem<Partial<HistorySettings>>(key(host));
  return { ...DEFAULT_SETTINGS, ...stored };
}

export async function writeHistorySettings(host: string, settings: HistorySettings): Promise<void> {
  await storage.setItem(key(host), settings);
}
