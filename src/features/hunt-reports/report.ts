// Hunt fights of an opened « Chasses » conversation (messagerie.php). Structure: docs/research/fourmizzz-pages.md.
import { fight as replayFight } from "@/game/army/combat";
import { PREYS } from "@/game/army/prey";
import { armyFromKeys, UNITS, type Levels } from "@/game/army/units";

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

const toInteger = (text: string | undefined) => Number((text ?? "").replace(/\D/g, ""));
/** « 1 199 »: digits in groups of three, so that a lazy match cannot stop at « 1 ». */
const NUMBER = "(\\d{1,3}(?:\\s\\d{3})*)";

/** « 1 921 Jeunes Soldates Naines, 119 Soldates Naines » → name → count. */
function readCounts(text: string): [string, number][] {
  return text.split(",").flatMap((part) => {
    const match = /^\s*([\d\s]+?)\s+(\D.*?)\s*$/.exec(part);
    return match?.[1] && match[2] ? [[match[2], toInteger(match[1])] as [string, number]] : [];
  });
}

const unitKey = (name: string) => UNITS.find((unit) => unit.plural === name || unit.name === name)?.key ?? name;

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

  let promoted = 0;
  for (const [, count] of flat.matchAll(new RegExp(`- ${NUMBER} \\D+? sont devenues des`, "g"))) {
    promoted += toInteger(count);
  }
  return {
    date,
    sent: Object.fromEntries(readCounts(sent).map(([name, count]) => [unitKey(name), count])),
    prey: Object.fromEntries(readCounts(prey)),
    attackBase: toInteger(dealt[1]),
    attackBonus: toInteger(dealt[2]),
    preyKilled: toInteger(dealt[3]),
    damageTaken: toInteger(taken[1]),
    antsKilled: toInteger(taken[2]),
    promoted,
    won: flat.includes("Vous avez gagné"),
    fieldWon: toInteger(new RegExp(`conquis ${NUMBER} cm²`).exec(flat)?.[1]),
    food: toInteger(new RegExp(`rapportent ${NUMBER}`).exec(flat)?.[1]),
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

/** The fight replayed by the engine. Weapons come from the report's bonus; the shield is the one remembered now. */
export function predictLosses(huntFight: HuntFight, levels: Pick<Levels, "shield" | "cochineal">): PredictedLosses {
  const weapons = huntFight.attackBase > 0 ? Math.round((huntFight.attackBonus / huntFight.attackBase) * 10) : 0;
  const pack = PREYS.map((prey) => huntFight.prey[prey.plural] ?? huntFight.prey[prey.name] ?? 0);
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
  /** Null without losses. */
  fieldPerAntLost: number | null;
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
    fieldPerAntLost: antsKilled > 0 ? fieldWon / antsKilled : null,
    offPrediction: rows.filter((row) => row.predicted && isOffPrediction(row.fight, row.predicted)).length,
  };
}
