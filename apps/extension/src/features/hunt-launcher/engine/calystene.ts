// Calystene's hunt loss tables (Hunting Simulator v2.00.38, http://alliancead2.free.fr/Outils/Repository/HuntSimv2.00/),
// statistics over more than 1 500 simulated hunts per ratio. Shown as a cross-check of our simulation.

export const REFERENCE_RATIOS = [1, 2, 3, 4, 5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 10] as const;
/** Chance to come out of the hunt with a « 10 % reply ». */
const REPLY_CHANCES = [0, 0, 0, 0.016, 0.093, 0.345, 0.577777778, 0.753, 0.837, 0.874, 0.937, 0.96, 0.989];
const MIN_LOSSES = [
  0.103971824, 0.066805442, 0.036854146, 0.014477073, 0.010067247, 0.008361713, 0.00751662, 0.007060666, 0.006692853,
  0.006402339, 0.006090569, 0.0057788, 0.005080623,
];
const AVERAGE_LOSSES = [
  0.14183641, 0.089382202, 0.065595625, 0.037509208, 0.024982573, 0.018532185, 0.014281932, 0.011725921, 0.010437083,
  0.009834768, 0.009339662, 0.008844556, 0.008502895,
];
const MAX_LOSSES = [
  0.33333334, 0.176739357, 0.113191158, 0.08245817, 0.051342954, 0.036955988, 0.03395735, 0.032083615, 0.026461955,
  0.024588162, 0.021774264, 0.018960366, 0.017190797,
];

export interface CalysteneEstimate {
  ratio: number;
  /** Largest reference ratio not above the real one; null under 1. */
  referenceRatio: number | null;
  replyChance: number;
  /** Losses in young dwarves (JSN). */
  min: number;
  average: number;
  max: number;
}

export function calysteneEstimate(attack: number, difficulty: number, shield: number): CalysteneEstimate {
  const ratio = attack / difficulty;
  const index = REFERENCE_RATIOS.findLastIndex((reference) => reference <= ratio + 1e-4);
  if (index < 0) return { ratio, referenceRatio: null, replyChance: 0, min: NaN, average: NaN, max: NaN };
  const losses = (table: readonly number[]) => ((table[index] ?? NaN) * difficulty * 10) / (10 + shield);
  return {
    ratio,
    referenceRatio: REFERENCE_RATIOS[index] ?? null,
    replyChance: REPLY_CHANCES[index] ?? 0,
    min: losses(MIN_LOSSES),
    average: losses(AVERAGE_LOSSES),
    max: losses(MAX_LOSSES),
  };
}
