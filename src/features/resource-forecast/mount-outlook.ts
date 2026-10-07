// Famine and full warehouse warnings under the header gauges (#boiteInfo), on every page.
import { formatNumber } from "@/utils/number-format";
import { formatDuration, formatEndTime } from "@/utils/time-format";
import { balancedFoodWorkers, outlook, type ColonyState } from "./forecast";

const BADGE_CLASS = "optizzz-outlook";
const HOUR = 60 * 60_000;
const HARVESTS_PER_DAY = 48;

/**
 * Adds (or redraws) the warnings under the food and materials gauges.
 * `readAt` is when `state` was read (the page load); `now` only moves the countdowns on.
 */
export function renderOutlook(doc: Document, state: ColonyState, readAt: Date, now = readAt): void {
  for (const old of doc.querySelectorAll(`.${BADGE_CLASS}`)) old.remove();
  const { famineAt, foodFullAt, materialsFullAt } = outlook(state, readAt);

  const foodCell = doc.querySelector("#boiteInfo .jauge_nourriture")?.closest("td.tooltip_boite_info");
  const foodWarning = famineAt
    ? badge(doc, "Famine dans", famineAt, now)
    : foodFullAt
      ? badge(doc, "Entrepôt plein dans", foodFullAt, now)
      : null;
  if (foodCell && foodWarning) {
    foodWarning.title = foodTooltip(state, readAt, now);
    foodCell.append(foodWarning);
  }

  const materialsCell = doc.querySelector("#boiteInfo .jauge_materiaux")?.closest("td.tooltip_boite_info");
  if (materialsCell && materialsFullAt) materialsCell.append(badge(doc, "Entrepôt plein dans", materialsFullAt, now));
}

function badge(doc: Document, label: string, at: Date, now: Date): HTMLElement {
  const remaining = Math.max(0, at.getTime() - now.getTime());
  const element = doc.createElement("div");
  element.className = BADGE_CLASS;
  if (remaining < 6 * HOUR) element.classList.add(`${BADGE_CLASS}-danger`);
  else if (remaining < 24 * HOUR) element.classList.add(`${BADGE_CLASS}-warning`);
  element.textContent = `${label} ${formatDuration(remaining)}`;
  return element;
}

const signed = (value: number) => `${value < 0 ? "−" : "+"}${formatNumber(Math.abs(value))}`;

function foodTooltip(state: ColonyState, readAt: Date, now: Date): string {
  const keep = 1 - state.taxRate;
  const harvest = state.foodWorkers * HARVESTS_PER_DAY;
  const tax = (harvest + state.mushroomPerDay) * state.taxRate;
  const net = (harvest + state.mushroomPerDay) * keep - state.armyPerDay;

  const parts = [
    `Récolte ${signed(harvest)}`,
    `champignonnière ${signed(state.mushroomPerDay)}`,
    `armée ${signed(-state.armyPerDay)}`,
  ];
  if (tax > 0) parts.push(`pillage ${signed(-tax)}`);

  const balance = balancedFoodWorkers(state, readAt);
  const lines = [
    `Nourriture par jour : ${signed(net)}`,
    parts.join(", "),
    balance === null
      ? "Équilibre impossible même avec toutes les ouvrières sur la nourriture"
      : `Équilibre : ${formatNumber(balance)} ouvrières sur la nourriture`,
  ];
  for (const hunt of state.hunts) {
    if (hunt.returnsAt > now) {
      lines.push(`Chasse de retour ${formatEndTime(hunt.returnsAt, now)} : +${formatNumber(hunt.fieldGain)} cm²`);
    }
  }
  return lines.join("\n");
}
