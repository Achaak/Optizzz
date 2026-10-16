// A player's harvest guessed from their TDC alone (docs/research/ressources-et-entretien.md, « Récolte »).
import { HARVESTS_PER_DAY } from "./forecast";

/** What a master always takes from a colony, before the bonus of their aphid stable. */
export const BASE_COLONY_TAX = 0.2;

/** Share of the colony's harvest its master takes: 20 % plus 1 % per level of their Étable à pucerons. */
export const colonyTaxRate = (aphidsLevel: number) => BASE_COLONY_TAX + aphidsLevel / 100;

export interface ProductionEstimate {
  /** Resources harvested a day, before the colony tax. */
  gross: number;
  tax: number;
  net: number;
}

/**
 * The most a TDC can harvest a day: one worker per cm², each bringing 48 a day. Food and materials together,
 * without the mushroom farm (unknown for another player). The tax is rounded down, as Ressources.php does.
 */
export function estimateProduction(field: number, taxRate: number): ProductionEstimate {
  const gross = field * HARVESTS_PER_DAY;
  const tax = Math.floor(gross * taxRate);
  return { gross, tax, net: gross - tax };
}
