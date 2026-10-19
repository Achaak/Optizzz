// What the Étable à pucerons brings, level by level: a bigger colony tax, more loot, lighter convoys (tutorial of
// construction.php, help of commerce.php, docs/research/ressources-et-entretien.md and combat.md).
import { colonyTaxRate, estimateProduction } from "./production";

/** Resources one worker carries: 10, plus 5 % per Étable à pucerons level (help of commerce.php). */
const carriedPerWorker = (aphids: number) => 10 * (1 + 0.05 * aphids);

export function workersNeeded(resources: number, aphids: number): number {
  return Math.ceil(resources / carriedPerWorker(aphids) - 1e-9);
}

/** Share of each resource of the nest a won attack takes: 30 %, plus 1 % per level. */
export const lootShare = (aphids: number) => 0.3 + 0.01 * aphids;

/** Convoys: the workers saved are counted on a million sent. */
const CONVOY_SAMPLE = 1_000_000;

export interface StableGain {
  /** The player's colonies, null when unknown. */
  colonies: number | null;
  /** Resources a day the colonies pay more, at most: each harvesting a resource per cm² 48 times a day. */
  daily: number;
  /** Workers fewer to send CONVOY_SAMPLE resources. */
  workersSaved: number;
  /** Workers free for convoys, null when unknown. */
  spare: number | null;
  /** Resources the spare workers carry more on each trip, null when unknown. */
  extraLoad: number | null;
}

/**
 * The workers free for convoys: those at home and those carrying convoys (the game takes them off its count until
 * they arrive), less one per cm² of TDC, which harvests.
 */
export function spareWorkers(
  { atHome, huntingField }: { atHome: number; huntingField: number },
  convoys: readonly { food: number; materials: number; arrivesAt: Date }[],
  aphids: number,
  now: Date,
): number {
  const away = convoys
    .filter((convoy) => convoy.arrivesAt > now)
    .reduce((sum, convoy) => sum + workersNeeded(convoy.food + convoy.materials, aphids), 0);
  return Math.max(0, atHome + away - huntingField);
}

/** What one more level brings, from `level` (those under way included), given the colonies' TDC and spare workers. */
export function stableGain(level: number, colonyFields: readonly number[] | null, spare: number | null): StableGain {
  const daily = (colonyFields ?? []).reduce(
    (sum, field) =>
      sum +
      estimateProduction(field, colonyTaxRate(level + 1)).tax -
      estimateProduction(field, colonyTaxRate(level)).tax,
    0,
  );
  return {
    colonies: colonyFields?.length ?? null,
    daily,
    workersSaved: workersNeeded(CONVOY_SAMPLE, level) - workersNeeded(CONVOY_SAMPLE, level + 1),
    spare,
    extraLoad:
      spare === null ? null : Math.floor(spare * (carriedPerWorker(level + 1) - carriedPerWorker(level)) + 1e-9),
  };
}

/** Whole days (or trips) a gain of `each` takes to pay `cost`; null without a gain. */
export const payback = (cost: number, each: number): number | null => (each > 0 ? Math.ceil(cost / each) : null);
