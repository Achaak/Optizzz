// Convoys on commerce.php: their trip, the workers they take, those on their way. Structure of the page and game
// rules: docs/research/fourmizzz-pages.md (« commerce.php »), docs/research/temps-de-trajet.md.
import { distance, travelTime } from "@/game/travel";
import { parseGameDuration } from "../work-queue/queue";

export interface MapPlayer {
  pseudo: string;
  x: number;
  y: number;
  alliance: string | null;
}

export interface ConvoyOnWay {
  recipient: string;
  food: number;
  materials: number;
  arrivesAt: Date;
  /** The game's line, to write the arrival time after it. */
  element: Element;
}

const toInteger = (text: string | undefined) => Number((text ?? "").replace(/\D/g, ""));

// « - Vous allez livrer 1 et 0 à Osirus_jack dans 1H 22m 22s »: the time left is written once, with no countdown.
const ON_WAY = /livrer\s+([\d\s]+?)\s+et\s+([\d\s]+?)\s+à\s+(.+?)\s+dans\s+(.+)$/;

export function readConvoysOnWay(doc: Document, now: Date): ConvoyOnWay[] {
  const title = [...doc.querySelectorAll("h3")].find((h3) => h3.textContent.includes("Convois en cours"));
  if (!title) return [];
  const convoys: ConvoyOnWay[] = [];
  for (let element = title.nextElementSibling; element; element = element.nextElementSibling) {
    if (element.tagName === "BR") continue;
    const match = ON_WAY.exec(element.textContent.replace(/\s+/g, " ").trim());
    const left = parseGameDuration(match?.[4] ?? "");
    if (!match || left === null) break;
    convoys.push({
      recipient: match[3] ?? "",
      food: toInteger(match[1]),
      materials: toInteger(match[2]),
      arrivesAt: new Date(now.getTime() + left),
      element,
    });
  }
  return convoys;
}

/** Resources one worker carries: 10, plus 5 % per Étable à pucerons level (help of commerce.php). */
export const carriedPerWorker = (aphids: number) => 10 * (1 + 0.05 * aphids);

export function workersNeeded(resources: number, aphids: number): number {
  return Math.ceil(resources / carriedPerWorker(aphids) - 1e-9);
}

export interface ConvoyInput {
  from: MapPlayer;
  to: MapPlayer;
  /** The sender's Vitesse d'attaque. */
  attackSpeed: number;
  aphids: number;
  resources: number;
  /** Workers with no work: the convoy takes them first. */
  idleWorkers: number;
  /** The game's own count (« Ouvrières requises »), when it shows one. */
  workers?: number;
}

export interface ConvoyPlan {
  distance: number;
  /** Milliseconds, one way: the workers do not travel back (observed on s5). */
  duration: number;
  arrivesAt: Date;
  workers: number;
  /** Harvesting workers taken once the idle ones are used up. */
  workingTaken: number;
  /** What they would have harvested during the trip: 1 resource per worker every 30 minutes. */
  harvestLost: number;
}

export function planConvoy(input: ConvoyInput, now: Date): ConvoyPlan {
  const gap = distance(input.from, input.to);
  const duration = travelTime(gap, input.attackSpeed) * 1000;
  const workers = input.workers ?? workersNeeded(input.resources, input.aphids);
  const workingTaken = Math.max(0, workers - input.idleWorkers);
  return {
    distance: gap,
    duration,
    arrivesAt: new Date(now.getTime() + duration),
    workers,
    workingTaken,
    harvestLost: Math.round((workingTaken * 2 * duration) / 3_600_000),
  };
}

/** Possible recipients: the sender's alliance first, then everyone else, each nearest first. */
export function recipients<P extends MapPlayer>(players: P[], senderPseudo: string): P[] {
  const sender = players.find((candidate) => candidate.pseudo === senderPseudo);
  if (!sender) return players.filter((candidate) => candidate.pseudo !== senderPseudo);
  const others = players.filter((candidate) => candidate !== sender);
  const ally = (candidate: P) => sender.alliance !== null && candidate.alliance === sender.alliance;
  return others.sort((a, b) => Number(ally(b)) - Number(ally(a)) || distance(sender, a) - distance(sender, b));
}
