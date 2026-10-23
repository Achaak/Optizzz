// « Mes niveaux »: one set of levels for all the site's tools, kept in the browser (localStorage). A tool opened
// without a link pre-fills its level fields with them and remembers what is typed; opened from a link, it shows the
// link's levels and leaves them untouched until « Reprendre mes niveaux ». See docs/features/site-outils.md.
import type { BuildingKey, ResearchKey } from "@optizzz/game/levels";

/** Where the browser keeps them. */
export const MY_LEVELS_KEY = "optizzz:my-levels";

/** The levels a tool may ask for (keys of @optizzz/game/levels). */
export const MY_LEVEL_KEYS = [
  "weapons",
  "shield",
  "attackSpeed",
  "huntSpeed",
  "dome",
  "lodge",
  "aphids",
  "cochineal",
  "architecture",
  "analysisRoom",
  "nursery",
  "solarium",
  "laying",
] as const satisfies readonly (BuildingKey | ResearchKey)[];

export type MyLevelKey = (typeof MY_LEVEL_KEYS)[number];

/** A level not known yet is missing: never 0 assumed. */
export type MyLevels = Partial<Record<MyLevelKey, number>>;

/** Levels of a tool's fields; null is an empty field. */
export type LevelFields<Key extends MyLevelKey> = Record<Key, number | null>;

const isLevel = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 1000;

/** What the browser keeps; anything else (another site's key, a hand edit) is left out. */
export function parseMyLevels(stored: string | null): MyLevels {
  if (!stored) return {};
  let json: unknown;
  try {
    json = JSON.parse(stored);
  } catch {
    return {};
  }
  if (typeof json !== "object" || json === null || Array.isArray(json)) return {};
  const record = json as Record<string, unknown>;
  return Object.fromEntries(MY_LEVEL_KEYS.flatMap((key) => (isLevel(record[key]) ? [[key, record[key]]] : [])));
}

/** The levels a tool asks for, to pre-fill its fields. */
export function pickLevels<Key extends MyLevelKey>(mine: MyLevels, keys: readonly Key[]): LevelFields<Key> {
  return Object.fromEntries(keys.map((key) => [key, mine[key] ?? null])) as LevelFields<Key>;
}

/** « Mes niveaux » as a tool sees them: `linked` while it shows a link's levels. */
export interface LevelsMemory {
  mine: MyLevels;
  linked: boolean;
}

export const openLevels = (mine: MyLevels, { fromLink }: { fromLink: boolean }): LevelsMemory => ({
  mine,
  linked: fromLink,
});

/** What is typed in level fields becomes « Mes niveaux », except over a link's levels. */
export function typedLevels(memory: LevelsMemory, typed: Partial<Record<MyLevelKey, number | null>>): LevelsMemory {
  if (memory.linked) return memory;
  const mine: MyLevels = Object.fromEntries(
    MY_LEVEL_KEYS.flatMap((key) => {
      const value = key in typed ? typed[key] : memory.mine[key];
      return value === null || value === undefined ? [] : [[key, value]];
    }),
  );
  return { mine, linked: false };
}

/** « Reprendre mes niveaux »: the visitor's levels back in the tool, and what is typed next is remembered again. */
export const resumeLevels = (memory: LevelsMemory): { memory: LevelsMemory; levels: MyLevels } => ({
  memory: { mine: memory.mine, linked: false },
  levels: memory.mine,
});
