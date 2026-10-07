// Research and building levels other features need, remembered per server as the player browses.
import { storage } from "wxt/utils/storage";

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

/** Row titles of laboratoire.php and construction.php (see docs/research/fourmizzz-pages.md). */
const ROWS: Record<string, keyof StoredLevels> = {
  armes: "weapons",
  "bouclier thoracique": "shield",
  "vitesse de chasse": "huntSpeed",
  "vitesse d’attaque": "attackSpeed",
  "etable à cochenilles": "cochineal",
  dôme: "dome",
  "loge impériale": "lodge",
  "etable à pucerons": "aphids",
};

const normalize = (text: string) => text.replace(/['’]/g, "’").trim().toLowerCase();

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

/** What was remembered, without reading any page. */
export async function loadStoredLevels(origin: string): Promise<StoredLevels> {
  return (await storage.getItem<StoredLevels>(storageKey(origin))) ?? {};
}

export async function storeLevels(origin: string, levels: StoredLevels): Promise<void> {
  const stored = (await storage.getItem<StoredLevels>(storageKey(origin))) ?? {};
  await storage.setItem(storageKey(origin), { ...stored, ...levels });
}

export interface HuntLevels {
  weapons: number;
  shield: number;
  huntSpeed: number;
  cochineal: number;
}

type FetchFn = (url: string) => Promise<Response>;

/** The page each level is read on. */
const PAGE_OF: Record<keyof StoredLevels, string> = {
  weapons: "laboratoire.php",
  shield: "laboratoire.php",
  huntSpeed: "laboratoire.php",
  attackSpeed: "laboratoire.php",
  cochineal: "construction.php",
  dome: "construction.php",
  lodge: "construction.php",
  aphids: "construction.php",
};

/** The asked levels, 0 when unknown; a page never visited yet is read once in the background. */
export async function loadLevelsOf<K extends keyof StoredLevels>(
  origin: string,
  keys: readonly K[],
  fetchFn: FetchFn = (url) => fetch(url),
): Promise<Record<K, number>> {
  let stored = (await storage.getItem<StoredLevels>(storageKey(origin))) ?? {};
  const pages = new Set(keys.filter((key) => stored[key] === undefined).map((key) => PAGE_OF[key]));
  for (const page of pages) {
    const html = await fetchFn(`${origin}/${page}`).then((response) => response.text());
    const read = readLevels(new DOMParser().parseFromString(html, "text/html"));
    await storeLevels(origin, read);
    stored = { ...stored, ...read };
  }
  return Object.fromEntries(keys.map((key) => [key, stored[key] ?? 0])) as Record<K, number>;
}

/** Levels a hunt needs. */
export function loadLevels(origin: string, fetchFn?: FetchFn): Promise<HuntLevels> {
  return loadLevelsOf(origin, ["weapons", "shield", "huntSpeed", "cochineal"], fetchFn);
}
