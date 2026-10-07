// What a hunt is likely to cost, over many prey draws.
import { fight } from "@/game/army/combat";
import { foodTarget } from "./difficulty";
import { drawPack, seededRandom } from "./draw";
import { UNITS, type Army, type Levels } from "@/game/army/units";

export interface HuntInput {
  army: Army;
  /** Hunting field at fight time. */
  field: number;
  amount: number;
  levels: Levels;
  samples: number;
}

/** Mean, 9 draws out of 10, worst draw. */
export interface Spread {
  mean: number;
  p90: number;
  max: number;
}

export interface HuntOutcome {
  winChance: number;
  /** Share of draws where the hunt is won with no unit lost (half-hp rule). */
  zeroLossChance: number;
  /** Food value of the units lost: mean, 9 draws out of 10, worst draw. */
  lossFood: Spread;
  /** Units lost, all types together. */
  lostUnits: Spread;
  /** Mean units per type, keyed by unit key. */
  lost: Record<string, number>;
  reportedDead: Record<string, number>;
  promoted: Record<string, number>;
  /** Food the prey bring back. */
  food: number;
}

function spread(values: number[]): Spread {
  if (values.length === 0) return { mean: 0, p90: 0, max: 0 };
  values.sort((a, b) => a - b);
  return {
    mean: values.reduce((sum, value) => sum + value, 0) / values.length,
    p90: values[Math.floor(0.9 * (values.length - 1))] ?? 0,
    max: values[values.length - 1] ?? 0,
  };
}

const byKey = (totals: number[], samples: number) =>
  Object.fromEntries(UNITS.map((unit, i) => [unit.key, samples > 0 ? (totals[i] ?? 0) / samples : 0]));

/** Each surface is judged on its own fixed packs, so that results do not flicker between runs. */
const seedFor = (field: number, amount: number) => Math.round(field) * 7919 + Math.round(amount);

export function evaluateHunt({ army, field, amount, levels, samples }: HuntInput): HuntOutcome {
  const random = seededRandom(seedFor(field, amount));
  const lost = UNITS.map(() => 0);
  const reportedDead = UNITS.map(() => 0);
  const promoted = UNITS.map(() => 0);
  const lossFoods: number[] = [];
  const lostCounts: number[] = [];
  let wins = 0;
  let zeroLoss = 0;
  for (let sample = 0; sample < samples; sample++) {
    const result = fight(army, drawPack(field, amount, random), levels);
    let lossFood = 0;
    let lostCount = 0;
    result.lost.forEach((count, i) => {
      lost[i] = (lost[i] ?? 0) + count;
      lossFood += count * (UNITS[i]?.food ?? 0);
      lostCount += count;
    });
    result.reportedDead.forEach((count, i) => (reportedDead[i] = (reportedDead[i] ?? 0) + count));
    result.promoted.forEach((count, i) => (promoted[i] = (promoted[i] ?? 0) + count));
    lossFoods.push(lossFood);
    lostCounts.push(lostCount);
    if (result.win) wins++;
    if (result.win && lossFood === 0) zeroLoss++;
  }
  return {
    winChance: samples > 0 ? wins / samples : 0,
    zeroLossChance: samples > 0 ? zeroLoss / samples : 0,
    lossFood: spread(lossFoods),
    lostUnits: spread(lostCounts),
    lost: byKey(lost, samples),
    reportedDead: byKey(reportedDead, samples),
    promoted: byKey(promoted, samples),
    food: foodTarget(field, amount),
  };
}
