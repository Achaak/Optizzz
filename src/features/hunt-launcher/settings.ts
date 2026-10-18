import { storage } from "wxt/utils/storage";

export type ObjectiveKind = "yield" | "ratio";

/** « mix »: the same mix of units in each hunt; « waves »: promotable units together in the last hunts. */
export type Dispatch = "mix" | "waves";

/** Parts of the launcher, folded or not, in the order of Calystene's simulator. */
export type SectionKey = "data" | "parameters" | "result" | "byField" | "launch" | "details";

/** Columns the player can add to the launch table, as « Paramétrage affichage » in Calystene's simulator. */
export type ColumnKey = "emptyUnits" | "difficulty" | "ratio" | "meanLosses" | "maxLosses" | "returns" | "edit";

/** Hunt launcher settings, stored per server in the browser. */
export interface Settings {
  objective: ObjectiveKind;
  /** « Rendement »: losses accepted, share of the food value of the units sent. */
  maxLossShare: number;
  /** « Ratio »: attack / difficulty. */
  ratio: number;
  /** Units kept home, by unit key. */
  reserve: Record<string, number>;
  dispatch: Dispatch;
  open: boolean;
  sections: Record<SectionKey, boolean>;
  columns: Record<ColumnKey, boolean>;
}

export const DEFAULT_SETTINGS: Settings = {
  objective: "ratio",
  maxLossShare: 0.01,
  ratio: 8,
  reserve: {},
  dispatch: "mix",
  open: true,
  sections: { data: true, parameters: true, result: true, byField: false, launch: true, details: false },
  columns: {
    emptyUnits: false,
    difficulty: false,
    ratio: false,
    meanLosses: false,
    maxLosses: false,
    returns: false,
    edit: false,
  },
};

const key = (host: string) => `local:huntLauncher:${host}:settings` as const;

export async function readSettings(host: string): Promise<Settings> {
  const stored = await storage.getItem<Partial<Settings>>(key(host));
  const settings = {
    ...DEFAULT_SETTINGS,
    ...stored,
    sections: { ...DEFAULT_SETTINGS.sections, ...stored?.sections },
    columns: { ...DEFAULT_SETTINGS.columns, ...stored?.columns },
  };
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
