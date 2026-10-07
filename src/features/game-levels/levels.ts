// Research and building levels other features need, remembered per server as the player browses.
import { storage } from "wxt/utils/storage";

export interface StoredLevels {
  weapons?: number;
  shield?: number;
  huntSpeed?: number;
  attackSpeed?: number;
  cochineal?: number;
}

/** Row titles of laboratoire.php and construction.php (see docs/research/fourmizzz-pages.md). */
const ROWS: Record<string, keyof StoredLevels> = {
  armes: "weapons",
  "bouclier thoracique": "shield",
  "vitesse de chasse": "huntSpeed",
  "vitesse d’attaque": "attackSpeed",
  "etable à cochenilles": "cochineal",
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

/** Levels a hunt needs; a page never visited yet is read once in the background. */
export async function loadLevels(origin: string, fetchFn: FetchFn = (url) => fetch(url)): Promise<HuntLevels> {
  let stored = (await storage.getItem<StoredLevels>(storageKey(origin))) ?? {};
  const missingResearch = stored.weapons === undefined || stored.shield === undefined || stored.huntSpeed === undefined;
  const pages = [
    ...(missingResearch ? ["laboratoire.php"] : []),
    ...(stored.cochineal === undefined ? ["construction.php"] : []),
  ];
  for (const page of pages) {
    const html = await fetchFn(`${origin}/${page}`).then((response) => response.text());
    const read = readLevels(new DOMParser().parseFromString(html, "text/html"));
    await storeLevels(origin, read);
    stored = { ...stored, ...read };
  }
  return {
    weapons: stored.weapons ?? 0,
    shield: stored.shield ?? 0,
    huntSpeed: stored.huntSpeed ?? 0,
    cochineal: stored.cochineal ?? 0,
  };
}
