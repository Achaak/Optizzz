// Convoys on commerce.php: their trip, the workers they take, those on their way. Structure of the page and game
// rules: docs/research/fourmizzz-pages.md (« commerce.php »), docs/research/temps-de-trajet.md.
import { distance, travelTime } from "@/game/travel";
import { parseGameDuration } from "@/game/pages/work-queue";
import { HARVESTS_PER_DAY } from "@/game/forecast";
import { parseGameInteger } from "@/utils/game-number";
import { formatNumber } from "@/utils/number-format";
import { formatEndTime, formatGameDuration } from "@/utils/time-format";

const DAY = 24 * 60 * 60_000;

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
  /** With Compte+, when the workers are back: « Retour le 7 oct. à 21h54 », as the game writes it. */
  back: string | null;
  /** The game's line. */
  element: Element;
}

// « - Vous allez livrer 1 et 0 à Osirus_jack dans 1H 22m 22s »: the time left is written once, with no countdown.
const ON_WAY = /livrer\s+([\d\s]+?)\s+et\s+([\d\s]+?)\s+à\s+(.+?)\s+dans\s+(.+)$/;

export function readConvoysOnWay(doc: Document, now: Date): ConvoyOnWay[] {
  const title = [...doc.querySelectorAll("h3")].find((h3) => h3.textContent.includes("Convois en cours"));
  if (!title) return [];
  const convoys: ConvoyOnWay[] = [];
  for (let element = title.nextElementSibling; element; element = element.nextElementSibling) {
    // Optizzz's own list of the convoys, written after the title.
    if (element.tagName === "BR" || element.classList.contains("optizzz-convoys")) continue;
    // With Compte+, « - Retour le 13 oct. à 21h59 » follows each line, in a <small>.
    if (element.tagName === "SMALL") {
      const last = convoys.at(-1);
      if (last) last.back = element.textContent.replace(/\s+/g, " ").trim() || null;
      continue;
    }
    const match = ON_WAY.exec(element.textContent.replace(/\s+/g, " ").trim());
    const left = parseGameDuration(match?.[4] ?? "");
    if (!match || left === null) break;
    convoys.push({
      recipient: match[3] ?? "",
      food: parseGameInteger(match[1]),
      materials: parseGameInteger(match[2]),
      arrivesAt: new Date(now.getTime() + left),
      back: null,
      element,
    });
  }
  return convoys;
}

/**
 * The convoy as a line to paste elsewhere: « Vous allez livrer 0 nourriture et 350 000 matériaux à X dans 47m 21s
 * · arrivée aujourd'hui 17 h 13 - Retour le 16 oct. à 17h13 ». The time left counts from `now`.
 */
export function convoyMessage(
  convoy: Pick<ConvoyOnWay, "recipient" | "food" | "materials" | "arrivesAt" | "back">,
  now: Date,
): string {
  const left = convoy.arrivesAt.getTime() - now.getTime();
  const load = `${formatNumber(convoy.food)} nourriture et ${formatNumber(convoy.materials)} matériaux`;
  const sent = `Vous allez livrer ${load} à ${convoy.recipient}${left > 0 ? ` dans ${formatGameDuration(left)}` : ""}`;
  const line = `${sent} · arrivée ${formatEndTime(convoy.arrivesAt, now)}`;
  return convoy.back ? `${line} - ${convoy.back}` : line;
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
  /** Share of the harvest a colonizer takes, between 0 and 1. */
  taxRate?: number;
}

export interface ConvoyPlan {
  distance: number;
  /** Milliseconds, one way: the workers do not travel back (observed on s5). */
  duration: number;
  arrivesAt: Date;
  workers: number;
  /** Harvesting workers taken once the idle ones are used up. */
  workingTaken: number;
  /** What they would have harvested during the trip, as the resource forecast counts it (tax taken off). */
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
    harvestLost: Math.round(((workingTaken * HARVESTS_PER_DAY * duration) / DAY) * (1 - (input.taxRate ?? 0))),
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

export interface WorkersAway {
  recipient: string;
  workers: number;
  /** The workers are back when the convoy arrives: they make no trip back. */
  backAt: Date;
}

/** The workers carrying the convoys still on their way, soonest back first. The game takes them off its count. */
export function workersAway(
  convoys: Pick<ConvoyOnWay, "recipient" | "food" | "materials" | "arrivesAt">[],
  aphids: number,
  now: Date,
): WorkersAway[] {
  return convoys
    .filter((convoy) => convoy.arrivesAt > now)
    .map((convoy) => ({
      recipient: convoy.recipient,
      workers: workersNeeded(convoy.food + convoy.materials, aphids),
      backAt: convoy.arrivesAt,
    }))
    .sort((a, b) => a.backAt.getTime() - b.backAt.getTime());
}
