import { storage } from "wxt/utils/storage";

/** The laying planner's shortcuts, set by the player, stored per server in the browser. */
export interface LayingSettings {
  /** « Tout payer dans … h ». */
  payDelays: number[];
  /** « Durée de ponte » : laying of … h. */
  durations: number[];
  /** « jusqu'à … » : when the player comes back, Paris time. */
  returnAt: { hours: number; minutes: number };
}

export const DEFAULT_LAYING_SETTINGS: LayingSettings = {
  payDelays: [3, 12],
  durations: [1, 8],
  returnAt: { hours: 8, minutes: 0 },
};

/** At most this many shortcuts per list, so that a row stays on one line. */
const MAX_HOURS = 4;

/** « 3 12 », « 3, 12 h » → [3, 12]: whole hours from 1 to a week, sorted, without repeats. */
export function parseHours(text: string): number[] {
  const hours = [...text.matchAll(/\d+/g)].map(([value]) => Number(value)).filter((h) => h >= 1 && h <= 168);
  return [...new Set(hours)].sort((a, b) => a - b).slice(0, MAX_HOURS);
}

/** « 08:00 » (a time field) → { hours: 8, minutes: 0 }; null when unreadable. */
export function parseClock(text: string): LayingSettings["returnAt"] | null {
  const match = /^(\d{1,2})[:h](\d{2})$/.exec(text.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours < 24 && minutes < 60 ? { hours, minutes } : null;
}

/** « 08:00 », the value of a time field. */
export const clockValue = ({ hours, minutes }: LayingSettings["returnAt"]) =>
  `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;

const key = (host: string) => `local:layingPlanner:${host}:settings` as const;

export async function readLayingSettings(host: string): Promise<LayingSettings> {
  const stored = await storage.getItem<Partial<LayingSettings>>(key(host));
  return { ...DEFAULT_LAYING_SETTINGS, ...stored };
}

export async function writeLayingSettings(host: string, settings: LayingSettings): Promise<void> {
  await storage.setItem(key(host), settings);
}
