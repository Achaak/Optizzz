import { storage } from "wxt/utils/storage";

export type ObjectiveKind = "yield" | "ratio";

/** Hunt launcher settings, stored per server in the browser. */
export interface Settings {
  objective: ObjectiveKind;
  /** « Rendement »: losses accepted, share of the food value of the units sent. */
  maxLossShare: number;
  /** « Ratio »: attack / difficulty. */
  ratio: number;
  /** Units kept home, by unit key. */
  reserve: Record<string, number>;
  open: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  objective: "yield",
  maxLossShare: 0.01,
  ratio: 8,
  reserve: {},
  open: true,
};

const key = (host: string) => `local:huntLauncher:${host}:settings` as const;

export async function readSettings(host: string): Promise<Settings> {
  const stored = await storage.getItem<Partial<Settings>>(key(host));
  const settings = { ...DEFAULT_SETTINGS, ...stored };
  // Objectives dropped since (« zéro perte », « pertes rares ») fall back to the default.
  if (!["yield", "ratio"].includes(settings.objective)) settings.objective = DEFAULT_SETTINGS.objective;
  return settings;
}

export async function writeSettings(host: string, settings: Settings): Promise<void> {
  await storage.setItem(key(host), settings);
}

/** What may go hunting: the army the game offers, minus the reserve. */
export function huntableArmy(available: Readonly<Record<string, number>>, reserve: Readonly<Record<string, number>>) {
  return Object.fromEntries(
    Object.entries(available).map(([unit, count]) => [unit, Math.max(0, count - (reserve[unit] ?? 0))]),
  );
}
