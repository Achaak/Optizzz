// Texts of the hunt launcher, kept out of the components to be tested.
import { nextDifficultyStep } from "./engine/difficulty";
import type { RatioChoice } from "./engine/extras";
import { unitLabel, UNITS } from "@/game/army/units";
import { formatDecimal, formatNumber } from "@/utils/number-format";
import { fromParisParts, parisParts } from "@/utils/time-format";

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

/** How the surface is split: « 2 × 115 cm² », « 120 + 118 cm² ». */
export function splitText(amounts: readonly number[]): string {
  if (amounts.length === 0) return "aucune chasse";
  const [first = 0] = amounts;
  if (amounts.every((amount) => amount === first)) return `${String(amounts.length)} × ${formatNumber(first)} cm²`;
  return `${amounts.map((amount) => formatNumber(amount)).join(" + ")} cm²`;
}

/** An option of the ratio list: « 8 → réplique 87 %, pertes moy. 12, 230 cm² (2 × 115) ». */
export function ratioOptionText(ratio: number, choice: RatioChoice | undefined): string {
  const name = formatDecimal(ratio);
  if (!choice) return name;
  if (choice.hunts === 0) return `${name} → aucune chasse possible`;
  const each = Math.floor(choice.totalAmount / choice.hunts);
  return `${name} → réplique ${formatChance(choice.replyChance)}, pertes moy. ${formatNumber(choice.lostUnits)}, ${formatNumber(choice.totalAmount)} cm² (${String(choice.hunts)} × ${formatNumber(each)})`;
}

/** « 15,8 % »: a share of something, one decimal. */
export const formatShare = (share: number) => `${formatDecimal(share * 100)} %`;

/** The instant a Paris clock shows `clock` (« 16:47 »), `days` days after today; null for a malformed clock. */
export function parisClockTime(now: Date, days: number, clock: string): Date | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(clock);
  if (!match) return null;
  const day = parisParts(new Date(now.getTime() + days * 86_400_000));
  return fromParisParts({
    year: day.year,
    month: day.month,
    day: day.day,
    hours: Number(match[1]),
    minutes: Number(match[2]),
  });
}
