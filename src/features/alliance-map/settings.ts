import { storage } from "wxt/utils/storage";

/** Map settings, stored per server in the browser. */
export interface Settings {
  k: number;
  manualLevel: number | null;
  /** Last Attack Speed level read on the Laboratory page. */
  labLevel: number | null;
  /** Levels entered per player, keyed by player id. */
  playerLevels: Record<string, number>;
}

export const DEFAULT_SETTINGS: Settings = {
  k: 3,
  manualLevel: null,
  labLevel: null,
  playerLevels: {},
};

const key = (host: string) => `local:allianceMap:${host}:settings` as const;

export async function readSettings(host: string): Promise<Settings> {
  const stored = await storage.getItem<Partial<Settings>>(key(host));
  return { ...DEFAULT_SETTINGS, ...stored };
}

export async function writeSettings(host: string, settings: Settings): Promise<void> {
  await storage.setItem(key(host), settings);
}
