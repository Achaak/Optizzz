// Reading game pages. Selectors are documented in docs/research/fourmizzz-pages.md.
import { parseGameInteger } from "@/utils/game-number";

export interface Stock {
  food: number;
  materials: number;
  workers: number;
  /** Hunting field (« TDC »), cm². */
  huntingField: number;
}

/** Raw numbers of the hidden `div#data`, present on every page with or without Compte+. */
export function readStock(doc: Document): Stock | null {
  const read = (id: string) => {
    const text = doc.querySelector(`#data #${id}`)?.textContent.trim();
    return text ? Number(text) : NaN;
  };
  const stock = {
    food: read("nb_nourriture"),
    materials: read("nb_materiaux"),
    workers: read("nb_ouvrieres"),
    huntingField: read("quantite_tdc"),
  };
  return Object.values(stock).some(Number.isNaN) ? null : stock;
}

export interface Hunt {
  returnsAt: Date;
  /** Hunting field won, cm². */
  fieldGain: number;
}

export interface Income {
  foodWorkers: number;
  materialWorkers: number;
  mushroomPerDay: number;
  /** Army food upkeep, troops away included. */
  armyPerDay: number;
  /** Share taken by the colonizer, between 0 and 1. */
  taxRate: number;
  nextHarvestAt: Date;
  hunts: Hunt[];
  /** Where the Compte+ sends new workers; « none » without Compte+. */
  newWorkersGoTo: "food" | "materials" | "none";
}

/** Seconds given to the game's countdown `reste(<seconds>, "<id>")`. */
function remainingSeconds(doc: Document, id: string): number | null {
  const pattern = new RegExp(`reste\\((\\d+),\\s*"${id}"\\)`);
  for (const script of doc.querySelectorAll("script")) {
    const match = pattern.exec(script.textContent);
    if (match?.[1]) return Number(match[1]);
  }
  return null;
}

/** A `var name = 12.5;` from the page's inline scripts. */
function scriptNumber(doc: Document, name: string): number | null {
  const pattern = new RegExp(`var\\s+${name}\\s*=\\s*([\\d.]+)`);
  for (const script of doc.querySelectorAll("script")) {
    const match = pattern.exec(script.textContent);
    if (match?.[1]) return Number(match[1]);
  }
  return null;
}

/** The `<strong>` right after the text containing `label`, in the daily summary paragraph. */
function summaryNumber(summary: Element, label: string): number | null {
  for (const strong of summary.querySelectorAll("strong")) {
    if (strong.previousSibling?.textContent?.includes(label)) return parseGameInteger(strong.textContent);
  }
  return null;
}

/** The `<strong>` whose following text, up to the next `<strong>`, contains `label`. */
function numberFollowedBy(summary: Element, label: string): number | null {
  for (const strong of summary.querySelectorAll("strong")) {
    let text = "";
    for (let next = strong.nextSibling; next && next.nodeName !== "STRONG"; next = next.nextSibling) {
      text += next.textContent ?? "";
    }
    if (text.includes(label)) return parseGameInteger(strong.textContent);
  }
  return null;
}

/** Hunts in progress on Ressources.php, in the game's order. */
export function readHunts(doc: Document, now: Date): Hunt[] {
  const hunts: Hunt[] = [];
  for (const countdown of doc.querySelectorAll('span[id^="chasse_"]')) {
    const gain = /conquérir\s+([\d\s]+)\s*cm/.exec(countdown.parentElement?.textContent ?? "");
    const seconds = remainingSeconds(doc, countdown.id);
    if (gain?.[1] && seconds !== null) {
      hunts.push({ returnsAt: new Date(now.getTime() + seconds * 1000), fieldGain: parseGameInteger(gain[1]) });
    }
  }
  return hunts;
}

/** Income figures of Ressources.php (all per day, before the colony tax). */
export function readIncome(doc: Document, now: Date): Income | null {
  const summary = doc.querySelector("#nbNourriture")?.closest("p");
  const foodInput = doc.querySelector<HTMLInputElement>("#RecolteNourriture");
  const materialInput = doc.querySelector<HTMLInputElement>("#RecolteMateriaux");
  const harvestSeconds = remainingSeconds(doc, "retour_ouvrieres");
  if (!summary || !foodInput || !materialInput || harvestSeconds === null) return null;

  const mushroomPerDay = scriptNumber(doc, "champi") ?? numberFollowedBy(summary, "champignonnière");
  const armyPerDay = summaryNumber(summary, "consomme");
  if (mushroomPerDay === null || armyPerDay === null) return null;

  const choice = doc.querySelector<HTMLInputElement>('input[name="choixOuvriere"]:checked')?.value;
  return {
    foodWorkers: parseGameInteger(foodInput.defaultValue),
    materialWorkers: parseGameInteger(materialInput.defaultValue),
    mushroomPerDay,
    armyPerDay,
    taxRate: (scriptNumber(doc, "pourcentagePillage") ?? 0) / 100,
    nextHarvestAt: new Date(now.getTime() + harvestSeconds * 1000),
    hunts: readHunts(doc, now),
    newWorkersGoTo: choice === "nourriture" ? "food" : choice === "materiaux" ? "materials" : "none",
  };
}

export interface Cost {
  food: number;
  materials: number;
  workers: number;
}

export interface CostRow {
  name: string;
  cost: Cost;
  /** A requirement is missing (« Requis: … »): it cannot be started whatever the stock. */
  locked: boolean;
  /** The row's wide description cell, where the forecast line goes. */
  description: Element | null;
}

/** Every row of construction.php or laboratoire.php, with what its next level costs. */
export function readCosts(doc: Document): CostRow[] {
  return [...doc.querySelectorAll(".ligneAmelioration")].flatMap((row) => {
    const name = row.querySelector(".desciption_amelioration h2")?.textContent.trim();
    const costCell = row.querySelector(".cout_amelioration");
    if (!name || !costCell) return [];
    const amount = (selector: string) => parseGameInteger(costCell.querySelector(selector)?.textContent);
    return [
      {
        name,
        cost: { food: amount(".nourriture"), materials: amount(".materiaux"), workers: amount(".ouvriere") },
        locked: !!row.querySelector(".verificationNonOK"),
        description: row.querySelector(".desciption_amelioration"),
      },
    ];
  });
}

export interface Capacities {
  food: number;
  materials: number;
}

/** Warehouse capacities, from their description on construction.php (« Capacité actuelle: 38 900 »). */
export function readCapacities(doc: Document): Capacities | null {
  const capacity = (warehouse: string) => {
    const row = readCosts(doc).find((cost) => cost.name === warehouse);
    const description = row?.description?.textContent ?? "";
    const match = /Capacité actuelle\s*:\s*([\d\s]+)/.exec(description);
    return match?.[1] ? parseGameInteger(match[1]) : null;
  };
  const food = capacity("Entrepôt de Nourriture");
  const materials = capacity("Entrepôt de Matériaux");
  return food === null || materials === null ? null : { food, materials };
}
