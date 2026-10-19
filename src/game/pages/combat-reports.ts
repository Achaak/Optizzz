// Attack reports of the « Combats » conversations (messagerie.php). Structure: docs/research/fourmizzz-pages.md.
import type { Place } from "@/game/army/battle";
import { parseCounts, unitKeyOf } from "@/game/army/units";
import { parseGameInteger } from "@/utils/game-number";

/** « 19 221 (+ 9 611) »: the damage before bonuses, then the Weapons bonus. */
export interface Damage {
  base: number;
  bonus: number;
}

/** One of my attacks, as its report tells it. No defence report has been seen yet. */
export interface CombatReport {
  /** « 16/10/26 14h58 ». */
  date: string;
  /** Where the fight took place; null when the report names a place not seen yet. */
  place: Place | null;
  /** The player attacked (not the occupier who may have defended them). */
  opponent: string;
  /** « mais une armée d'occupation est déjà présente »: the defenders are their colonizer's army. */
  occupied: boolean;
  /** Unit counts by unit key; a name the engine does not know is kept as written. */
  attackers: Record<string, number>;
  defenders: Record<string, number>;
  dealt: Damage;
  /** Defenders killed. */
  killed: number;
  taken: Damage;
  /** My ants killed. */
  lost: number;
  won: boolean;
}

/** Field, food and materials one message of a « Butin chez … » conversation says were taken. */
export interface Loot {
  date: string;
  opponent: string;
  field: number;
  food: number;
  materials: number;
}

/** « 1 199 »: digits in groups of three, so that a lazy match cannot stop at « 1 ». */
const NUMBER = "(\\d{1,3}(?:\\s\\d{3})*)";

const PLACES: [RegExp, Place][] = [
  [/^le Terrain de Chasse$/i, "field"],
  [/^la fourmilière$/i, "nest"],
  [/^la Loge/i, "lodge"],
];

const troops = (list: string) =>
  Object.fromEntries(parseCounts(list).map(([name, count]) => [unitKeyOf(name) ?? name, count]));

const damage = (base: string | undefined, bonus: string | undefined): Damage => ({
  base: parseGameInteger(base),
  bonus: parseGameInteger(bonus),
});

/** One attack from the text of its `.contenuJoueur`; null when it is no attack report. */
export function readCombat(date: string, text: string): CombatReport | null {
  const flat = text.replace(/\s+/g, " ");
  const target = /Vous attaquez (.+?) de (\S+?),?\s*(mais une armée d'occupation|Troupes en attaque)/.exec(flat);
  const attackers = /Troupes en attaque : (.+?)\.\s*Troupes en défense/.exec(flat)?.[1];
  const defenders = /Troupes en défense : (.+?)\.\s*Vous infligez/.exec(flat)?.[1];
  const dealt = new RegExp(`Vous infligez ${NUMBER} \\(\\+ ${NUMBER}\\) dégâts et tuez ${NUMBER} ennemies`).exec(flat);
  const taken = new RegExp(`inflige ${NUMBER} \\(\\+ ${NUMBER}\\) dégâts à vos fourmis et en tue ${NUMBER}`).exec(flat);
  if (!target?.[1] || !target[2] || !attackers || !defenders || !dealt || !taken) return null;
  const placeName = target[1];
  return {
    date,
    place: PLACES.find(([pattern]) => pattern.test(placeName))?.[1] ?? null,
    opponent: target[2],
    occupied: target[3] !== "Troupes en attaque",
    attackers: troops(attackers),
    defenders: troops(defenders),
    dealt: damage(dealt[1], dealt[2]),
    killed: parseGameInteger(dealt[3]),
    taken: damage(taken[1], taken[2]),
    lost: parseGameInteger(taken[3]),
    won: flat.includes("Vous avez gagné"),
  };
}

/** One message of a « Butin chez … » conversation; null for anything else (the colony taken, a fight). */
export function readLoot(date: string, text: string): Loot | null {
  const flat = text.replace(/\s+/g, " ");
  const owner = /appartenaient à (\S+?)\.?\s*$/.exec(flat.trim())?.[1];
  const field = new RegExp(`Vos fourmis ont conquis ${NUMBER} cm²`).exec(flat);
  // The food and materials icons are gone from the text: « pillé 15 et 15 lors… », food first.
  const pillaged = new RegExp(`Vos fourmis ont pillé ${NUMBER}\\s*et ${NUMBER}`).exec(flat);
  if (!owner || (!field && !pillaged)) return null;
  return {
    date,
    opponent: owner,
    field: parseGameInteger(field?.[1]),
    food: parseGameInteger(pillaged?.[1]),
    materials: parseGameInteger(pillaged?.[2]),
  };
}

/**
 * The Weapons level the bonus shows: +10 % of the base damage per level, rounded (19 221 → + 9 611 at level 5).
 * Null under 10 base damage: the rounding hides the level.
 */
export function combatWeapons({ base, bonus }: Damage): number | null {
  return base >= 10 ? Math.round((bonus / base) * 10) : null;
}

/** Attacks and loots of a conversation's detail (`tr.contenu_conversation`), oldest first like the game shows them. */
export function readCombatConversation(conversation: Element): { combats: CombatReport[]; loots: Loot[] } {
  const combats: CombatReport[] = [];
  const loots: Loot[] = [];
  for (const row of conversation.querySelectorAll('tr[id^="message_"]')) {
    const date = row.querySelector("td.expe")?.textContent.replace(/\s+/g, " ").trim().replace(" à ", " ") ?? "";
    const text = row.querySelector(".contenuJoueur")?.textContent ?? "";
    const combat = readCombat(date, text);
    if (combat) combats.push(combat);
    const loot = combat ? null : readLoot(date, text);
    if (loot) loots.push(loot);
  }
  return { combats, loots };
}
