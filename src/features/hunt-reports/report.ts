// Hunt fights of an opened « Chasses » conversation (messagerie.php). Structure: docs/research/fourmizzz-pages.md.
import { fight as replayFight } from "@/game/army/combat";
import { PREYS, preyIndexOf } from "@/game/army/prey";
import { armyFromKeys, parseCounts, unitKeyOf, UNITS, type Levels } from "@/game/army/units";
import { parseGameInteger } from "@/utils/game-number";

export interface HuntFight {
  /** « 07/10/26 11h08 ». */
  date: string;
  /** Unit counts by unit key (JSN, SN…), in the report's order. */
  sent: Record<string, number>;
  /** Prey counts by name as written in the report (« Petites araignées »). */
  prey: Record<string, number>;
  /** « Vous infligez 6 358 (+ 2 544) »: base damage, then the Weapons bonus. */
  attackBase: number;
  attackBonus: number;
  preyKilled: number;
  damageTaken: number;
  antsKilled: number;
  promoted: number;
  /** Promoted ants by the unit key they were (« 54 Jeunes Soldates Naines sont devenues… » → { JSN: 54 }). */
  promotions: Record<string, number>;
  won: boolean;
  fieldWon: number;
  food: number;
}

export interface PredictedLosses {
  /** Dead ants as the report counts them. */
  dead: number;
  /** Ants wounded past half their hp: not in the report, but they do not come back. */
  wounded: number;
}

/** « 1 199 »: digits in groups of three, so that a lazy match cannot stop at « 1 ». */
const NUMBER = "(\\d{1,3}(?:\\s\\d{3})*)";

/** One fight from the text of its `.contenuJoueur`; null when it is not a hunt fight. */
export function readFight(date: string, text: string): HuntFight | null {
  const flat = text.replace(/\s+/g, " ");
  const sent = /Troupes en attaque : (.+?)\.\s*Troupes en défense/.exec(flat)?.[1];
  const prey = /Troupes en défense : (.+?)\.\s*Vous infligez/.exec(flat)?.[1];
  const dealt = new RegExp(`Vous infligez ${NUMBER} \\(\\+ ${NUMBER}\\) dégâts et tuez ${NUMBER} ennemies`).exec(flat);
  const taken = new RegExp(`inflige ${NUMBER} \\(\\+ [\\d\\s]+\\) dégâts à vos fourmis et en tue ${NUMBER}\\.`).exec(
    flat,
  );
  if (!sent || !prey || !dealt || !taken) return null;

  const promotions: Record<string, number> = {};
  for (const [, count, name] of flat.matchAll(new RegExp(`- ${NUMBER} (\\D+?) sont devenues des`, "g"))) {
    const key = unitKeyOf(name ?? "") ?? name ?? "";
    promotions[key] = (promotions[key] ?? 0) + parseGameInteger(count);
  }
  return {
    date,
    sent: Object.fromEntries(parseCounts(sent).map(([name, count]) => [unitKeyOf(name) ?? name, count])),
    prey: Object.fromEntries(parseCounts(prey)),
    attackBase: parseGameInteger(dealt[1]),
    attackBonus: parseGameInteger(dealt[2]),
    preyKilled: parseGameInteger(dealt[3]),
    damageTaken: parseGameInteger(taken[1]),
    antsKilled: parseGameInteger(taken[2]),
    promoted: Object.values(promotions).reduce((sum, count) => sum + count, 0),
    promotions,
    won: flat.includes("Vous avez gagné"),
    fieldWon: parseGameInteger(new RegExp(`conquis ${NUMBER} cm²`).exec(flat)?.[1]),
    food: parseGameInteger(new RegExp(`rapportent ${NUMBER}`).exec(flat)?.[1]),
  };
}

/** Fights of the conversation's detail (`tr.contenu_conversation`), oldest first like the game shows them. */
export function readConversation(conversation: Element): HuntFight[] {
  return [...conversation.querySelectorAll('tr[id^="message_"]')].flatMap((row) => {
    const date = row.querySelector("td.expe")?.textContent.replace(/\s+/g, " ").trim().replace(" à ", " ") ?? "";
    const parsed = readFight(date, row.querySelector(".contenuJoueur")?.textContent ?? "");
    return parsed ? [parsed] : [];
  });
}

/** Units and prey of the report the engine does not know: replaying the fight without them would be wrong. */
export function unknownEntries(huntFight: HuntFight): string[] {
  const units = Object.keys(huntFight.sent).filter((key) => !UNITS.some((unit) => unit.key === key));
  const prey = Object.keys(huntFight.prey).filter((name) => preyIndexOf(name) === -1);
  return [...units, ...prey];
}

/** « 20 combats affichés sur 191 »: the number of fights in the conversation's title, « … en 191 expéditions ». */
export const expeditionCount = (title: string): number | null => {
  const count = /([\d\s]+)\s+expéditions?/.exec(title)?.[1];
  return count ? Number(count.replace(/\s/g, "")) : null;
};

/** The fight replayed by the engine. Weapons come from the report's bonus; the shield is the one remembered now. */
export function predictLosses(huntFight: HuntFight, levels: Pick<Levels, "shield" | "cochineal">): PredictedLosses {
  const weapons = huntFight.attackBase > 0 ? Math.round((huntFight.attackBonus / huntFight.attackBase) * 10) : 0;
  const pack = PREYS.map(() => 0);
  for (const [name, count] of Object.entries(huntFight.prey)) {
    const i = preyIndexOf(name);
    if (i >= 0) pack[i] = (pack[i] ?? 0) + count;
  }
  const result = replayFight(armyFromKeys(huntFight.sent), pack, { weapons, ...levels });
  const sum = (counts: number[]) => counts.reduce((total, count) => total + count, 0);
  const dead = sum(result.reportedDead);
  return { dead, wounded: sum(result.lost) - dead };
}

/** Real dead ants far from the prediction: more than one ant and more than 20 % apart. */
export function isOffPrediction(huntFight: HuntFight, predicted: PredictedLosses): boolean {
  const gap = Math.abs(huntFight.antsKilled - predicted.dead);
  return gap > 1 && gap > 0.2 * predicted.dead;
}

const writeCounts = (counts: Record<string, number>) =>
  Object.entries(counts)
    .map(([name, count]) => `${String(count)} ${name}`)
    .join(", ");

/** `date | sent | prey | dealt (base+bonus) | prey killed | taken | ants killed | promoted | cm² | food`. */
export function toReportLine(huntFight: HuntFight): string {
  return [
    huntFight.date,
    writeCounts(huntFight.sent),
    writeCounts(huntFight.prey),
    `${String(huntFight.attackBase)}+${String(huntFight.attackBonus)}`,
    huntFight.preyKilled,
    huntFight.damageTaken,
    huntFight.antsKilled,
    huntFight.promoted,
    huntFight.fieldWon,
    huntFight.food,
  ].join("|");
}

export interface Summary {
  fights: number;
  antsKilled: number;
  fieldWon: number;
  food: number;
  offPrediction: number;
}

export function summarize(rows: { fight: HuntFight; predicted: PredictedLosses | null }[]): Summary {
  const total = (pick: (row: HuntFight) => number) => rows.reduce((sum, row) => sum + pick(row.fight), 0);
  const antsKilled = total((row) => row.antsKilled);
  const fieldWon = total((row) => row.fieldWon);
  return {
    fights: rows.length,
    antsKilled,
    fieldWon,
    food: total((row) => row.food),
    offPrediction: rows.filter((row) => row.predicted && isOffPrediction(row.fight, row.predicted)).length,
  };
}

/** What the fights did to the army: ants lost and promoted, in attack « hors bonus » and in laying time. */
export interface ArmyBalance {
  /** Dead ants by unit key: the report gives only their number, they are taken from the front line first. */
  dead: Record<string, number>;
  /** Laying time of the dead before the player's bonuses: multiply by the laying speed. */
  deadLayingSeconds: number;
  /** Attack « hors bonus » of the dead. */
  deadAttack: number;
  /** Promoted ants by the unit key they became. */
  promoted: Record<string, number>;
  /** Attack « hors bonus » the promotions add. */
  promotedAttack: number;
}

const unitOf = (key: string) => UNITS.find((unit) => unit.key === key);

/** In a hunt, the prey hit our units in `UNITS` order: the dead are the first ones of the army sent. */
function deadByUnit(huntFight: HuntFight): Record<string, number> {
  const dead: Record<string, number> = {};
  let left = huntFight.antsKilled;
  for (const unit of UNITS) {
    const count = Math.min(left, huntFight.sent[unit.key] ?? 0);
    if (count <= 0) continue;
    dead[unit.key] = count;
    left -= count;
  }
  return dead;
}

export function armyBalance(fights: HuntFight[]): ArmyBalance {
  const balance: ArmyBalance = { dead: {}, deadLayingSeconds: 0, deadAttack: 0, promoted: {}, promotedAttack: 0 };
  for (const huntFight of fights) {
    for (const [key, count] of Object.entries(deadByUnit(huntFight))) {
      const unit = unitOf(key);
      balance.dead[key] = (balance.dead[key] ?? 0) + count;
      balance.deadLayingSeconds += count * (unit?.layingSeconds ?? 0);
      balance.deadAttack += count * (unit?.attack ?? 0);
    }
    for (const [key, count] of Object.entries(huntFight.promotions)) {
      const from = unitOf(key);
      const to = from?.promotesTo ? unitOf(from.promotesTo) : undefined;
      if (!from || !to) continue;
      balance.promoted[to.key] = (balance.promoted[to.key] ?? 0) + count;
      balance.promotedAttack += count * (to.attack - from.attack);
    }
  }
  // Promotions in UNITS order, whatever order the fights wrote them in.
  balance.promoted = Object.fromEntries(
    UNITS.flatMap((unit) => {
      const count = balance.promoted[unit.key];
      return count ? [[unit.key, count] as const] : [];
    }),
  );
  return balance;
}
