// Drawing the prey of a hunt. Rule reconstructed by « Chasse à zéro perte »: docs/research/chasse.md.
import { foodTarget } from "./difficulty";
import { PREYS } from "@/game/army/prey";

export type Random = () => number;

/** Small, fast, seedable generator (mulberry32), so that a surface is always judged on the same packs. */
export function seededRandom(seed: number): Random {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MAX_PICKS = 5000;
const SMALL_SPIDER_FOOD = PREYS[0]?.food ?? 1;

/**
 * Until the food target is covered: a random prey type takes 45 to 75 % of the target (capped by what is left);
 * a type too big to fit once is replaced by a block of small spiders worth 5 % of the target.
 */
export function drawPack(field: number, amount: number, random: Random): number[] {
  const target = foodTarget(field, amount);
  const pack = PREYS.map(() => 0);
  const fallbackBlock = Math.ceil((0.05 * target) / SMALL_SPIDER_FOOD - 1e-9);
  let left = target;
  for (let pick = 0; left > 1e-9 && pick < MAX_PICKS; pick++) {
    const type = Math.floor(random() * PREYS.length);
    const percent = 45 + Math.floor(random() * 31);
    const food = PREYS[type]?.food ?? Infinity;
    const count = Math.floor(Math.min((percent * target) / 100, left) / food + 1e-9);
    if (count >= 1) {
      pack[type] = (pack[type] ?? 0) + count;
      left -= count * food;
    } else {
      pack[0] = (pack[0] ?? 0) + fallbackBlock;
      left -= fallbackBlock * SMALL_SPIDER_FOOD;
    }
  }
  return pack;
}
