// Research and building levels other features need, remembered per server as the player browses.
import { storage } from "wxt/utils/storage";
import { fetchGamePage } from "@/utils/game-page";

export interface StoredLevels {
  weapons?: number;
  shield?: number;
  huntSpeed?: number;
  attackSpeed?: number;
  cochineal?: number;
  dome?: number;
  /** Loge Impériale. */
  lodge?: number;
  /** Étable à pucerons. */
  aphids?: number;
}

/** Row titles of laboratoire.php and construction.php (see docs/research/fourmizzz-pages.md), without accents. */
const ROWS: Record<string, keyof StoredLevels> = {
  armes: "weapons",
  "bouclier thoracique": "shield",
  "vitesse de chasse": "huntSpeed",
  "vitesse d’attaque": "attackSpeed",
  "etable a cochenilles": "cochineal",
  dome: "dome",
  "loge imperiale": "lodge",
  "etable a pucerons": "aphids",
};

/** « Étable à pucerons » and « Etable a pucerons » are the same row: the game is not consistent with accents. */
const normalize = (text: string) =>
  text.normalize("NFD").replace(/\p{M}/gu, "").replace(/['’]/g, "’").trim().toLowerCase();

export function readLevels(doc: Document): StoredLevels {
  const levels: StoredLevels = {};
  for (const row of doc.querySelectorAll(".ligneAmelioration")) {
    const key = ROWS[normalize(row.querySelector("h2")?.textContent ?? "")];
    const level = /\d+/.exec(row.querySelector(".niveau_amelioration")?.textContent ?? "");
    if (key && level) levels[key] = Number(level[0]);
  }
  return levels;
}

const storageKey = (origin: string) => `local:gameLevels:${new URL(origin).host}` as const;
const readAtKey = (origin: string) => `local:gameLevels:${new URL(origin).host}:readAt` as const;

export type LevelsPage = "laboratoire.php" | "construction.php";

/** Levels change when a research or a building ends: past this age, their page is read again before use. */
export const LEVELS_MAX_AGE = 12 * 60 * 60_000;

/** What was remembered, without reading any page. */
export async function loadStoredLevels(origin: string): Promise<StoredLevels> {
  return (await storage.getItem<StoredLevels>(storageKey(origin))) ?? {};
}

/** Keeps `levels`; with the `page` they were all read on, and when, so that they can age. */
export async function storeLevels(origin: string, levels: StoredLevels, page?: LevelsPage, readAt = new Date()) {
  const stored = (await storage.getItem<StoredLevels>(storageKey(origin))) ?? {};
  await storage.setItem(storageKey(origin), { ...stored, ...levels });
  if (!page || Object.keys(levels).length === 0) return;
  const dates = (await storage.getItem<Partial<Record<LevelsPage, number>>>(readAtKey(origin))) ?? {};
  await storage.setItem(readAtKey(origin), { ...dates, [page]: readAt.getTime() });
}

export interface HuntLevels {
  weapons: number;
  shield: number;
  huntSpeed: number;
  cochineal: number;
}

type FetchFn = (url: string) => Promise<Response>;

/** A level that could not be read: its page did not answer or has no such row (session expired, maintenance…). */
export class UnknownLevelsError extends Error {
  constructor(readonly pages: string[]) {
    super(`Niveaux illisibles sur ${pages.join(", ")}`);
    this.name = "UnknownLevelsError";
  }
}

/** Where to read the levels missing from the message shown to the player. */
export const unknownLevelsHint = (error: unknown): string =>
  error instanceof UnknownLevelsError
    ? `Niveaux inconnus : passez par ${error.pages.map((page) => (page === "laboratoire.php" ? "le Laboratoire" : "Construction")).join(" et ")} pour qu'Optizzz les lise.`
    : "Niveaux inconnus : passez par le Laboratoire et Construction pour qu'Optizzz les lise.";

/** The page each level is read on. */
const PAGE_OF: Record<keyof StoredLevels, LevelsPage> = {
  weapons: "laboratoire.php",
  shield: "laboratoire.php",
  huntSpeed: "laboratoire.php",
  attackSpeed: "laboratoire.php",
  cochineal: "construction.php",
  dome: "construction.php",
  lodge: "construction.php",
  aphids: "construction.php",
};

/** Pages being read, so that features asking at the same time share one request. */
const reading = new Map<string, Promise<StoredLevels>>();

/** Reads a levels page now and remembers what it holds; an empty result when the page did not answer. */
export async function refreshLevels(
  origin: string,
  page: LevelsPage,
  fetchFn: FetchFn = (url) => fetch(url),
): Promise<StoredLevels> {
  return readPage(origin, page, fetchFn);
}

async function readPage(origin: string, page: LevelsPage, fetchFn: FetchFn): Promise<StoredLevels> {
  const doc = await fetchGamePage(`${origin}/${page}`, fetchFn);
  if (!doc) return {};
  const read = readLevels(doc);
  await storeLevels(origin, read, page);
  return read;
}

/**
 * The asked levels; a page never visited yet, or read more than `LEVELS_MAX_AGE` ago, is read in the background
 * (the levels last read stay if it fails). Throws `UnknownLevelsError` when a level stays unknown: a guess of 0 would
 * silently give wrong travel times, combats and hunts.
 */
export async function loadLevelsOf<K extends keyof StoredLevels>(
  origin: string,
  keys: readonly K[],
  fetchFn: FetchFn = (url) => fetch(url),
  now = new Date(),
): Promise<Record<K, number>> {
  let stored = (await storage.getItem<StoredLevels>(storageKey(origin))) ?? {};
  const dates = (await storage.getItem<Partial<Record<LevelsPage, number>>>(readAtKey(origin))) ?? {};
  const stale = (page: LevelsPage) => now.getTime() - (dates[page] ?? 0) > LEVELS_MAX_AGE;
  const pages = new Set(
    keys.filter((key) => stored[key] === undefined || stale(PAGE_OF[key])).map((key) => PAGE_OF[key]),
  );
  for (const page of pages) {
    const id = `${origin}/${page}`;
    let pending = reading.get(id);
    if (!pending) {
      pending = readPage(origin, page, fetchFn).finally(() => reading.delete(id));
      reading.set(id, pending);
    }
    stored = { ...stored, ...(await pending) };
  }
  const missing = keys.filter((key) => stored[key] === undefined);
  if (missing.length > 0) throw new UnknownLevelsError([...new Set(missing.map((key) => PAGE_OF[key]))]);
  return Object.fromEntries(keys.map((key) => [key, stored[key] ?? 0])) as Record<K, number>;
}

/** Levels a hunt needs. */
export function loadLevels(origin: string, fetchFn?: FetchFn): Promise<HuntLevels> {
  return loadLevelsOf(origin, ["weapons", "shield", "huntSpeed", "cochineal"], fetchFn);
}
