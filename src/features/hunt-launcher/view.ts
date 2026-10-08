// Texts of the hunt launcher, kept out of the components to be tested.
import { nextDifficultyStep } from "./engine/difficulty";
import { unitLabel, UNITS } from "@/game/army/units";
import { formatNumber } from "@/utils/number-format";

/** A chance as a player reads it: 100 % and 0 % only when certain. */
export function formatChance(chance: number): string {
  if (chance >= 1) return "100 %";
  if (chance <= 0) return "0 %";
  if (chance > 0.995) return "> 99 %";
  if (chance < 0.01) return "< 1 %";
  return `${String(Math.round(chance * 100))} %`;
}

/** « 1 000 JSN + 70 SN » */
export function unitsText(army: Readonly<Record<string, number>>): string {
  const parts = UNITS.filter((unit) => (army[unit.key] ?? 0) > 0).map(
    (unit) => `${formatNumber(army[unit.key] ?? 0)} ${unitLabel(unit.key)}`,
  );
  return parts.length > 0 ? parts.join(" + ") : "aucune unité";
}

/** The next difficulty step, or the warning that these hunts cross it. */
export function stepNotice(field: number, totalAmount: number): string {
  const step = nextDifficultyStep(field);
  const after = field + totalAmount;
  if (after >= step) {
    return `Ces chasses font passer votre terrain au palier de ${formatNumber(step)} cm² : les suivantes seront 4 % plus difficiles.`;
  }
  return `Prochain palier de difficulté à ${formatNumber(step)} cm² (encore ${formatNumber(step - after)} cm² après ces chasses).`;
}
