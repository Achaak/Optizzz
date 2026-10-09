import { storage } from "wxt/utils/storage";

/** Map settings, stored per server in the browser. */
export interface Settings {
  k: number;
  manualLevel: number | null;
  /** Last Attack Speed level read on the Laboratory page. */
  labLevel: number | null;
  /** Levels entered per player, keyed by player id. */
  playerLevels: Record<string, number>;
  /** When each of `playerLevels` was entered (ms), to weigh it against a shared state; missing for older entries. */
  playerLevelsAt: Record<string, number>;
}

export const DEFAULT_SETTINGS: Settings = {
  k: 3,
  manualLevel: null,
  labLevel: null,
  playerLevels: {},
  playerLevelsAt: {},
};

const key = (host: string) => `local:allianceMap:${host}:settings` as const;

export async function readSettings(host: string): Promise<Settings> {
  const stored = await storage.getItem<Partial<Settings>>(key(host));
  return { ...DEFAULT_SETTINGS, ...stored };
}

export async function writeSettings(host: string, settings: Settings): Promise<void> {
  await storage.setItem(key(host), settings);
}

/** Calls `onChange` when the map's settings change (levels entered on the map, read by the chain). */
export function watchSettings(host: string, onChange: (settings: Settings) => void): () => void {
  return storage.watch<Partial<Settings>>(key(host), (stored) => {
    onChange({ ...DEFAULT_SETTINGS, ...stored });
  });
}
