// Famine and full warehouse warnings under the header gauges (#boiteInfo), on every page.
import { formatNumber } from "@/utils/number-format";
import { formatDuration, formatEndTime } from "@/utils/time-format";
import { urgencyOf } from "@/utils/urgency";
import { balancedFoodWorkers, dailyBalance, HARVESTS_PER_DAY, outlook, type ColonyState } from "@/game/forecast";

const BADGE_CLASS = "optizzz-outlook";

/**
 * The game's tooltip (jQuery UI, on the gauge cell) would take the badge's `title` and lose its line breaks: the
 * badge has its own, and keeps the game's from opening over it.
 */
export const OUTLOOK_TIP_STYLE = `
.optizzz-outlook[data-optizzz-tip] { position: relative; cursor: help; }
.optizzz-outlook[data-optizzz-tip]:hover::after, .optizzz-outlook[data-optizzz-tip]:focus::after {
  content: attr(data-optizzz-tip); position: absolute; left: 0; top: 100%; z-index: 1000; width: max-content;
  max-width: 340px; padding: 4px 6px; white-space: pre-line; text-align: left; font-weight: normal;
  color: var(--optizzz-text); background: var(--optizzz-surface-raised); border: 1px solid var(--optizzz-border); }`;

/** What `state` gives, computed once: only the countdowns move afterwards. */
const computed = new WeakMap<
  ColonyState,
  { outlook: ReturnType<typeof outlook>; balance: number | null; readAt: number }
>();

function computeOnce(state: ColonyState, readAt: Date) {
  const known = computed.get(state);
  if (known?.readAt === readAt.getTime()) return known;
  const result = {
    outlook: outlook(state, readAt),
    balance: balancedFoodWorkers(state, readAt),
    readAt: readAt.getTime(),
  };
  computed.set(state, result);
  return result;
}

/**
 * Adds (or redraws) the warnings under the food and materials gauges.
 * `readAt` is when `state` was read (the page load); `now` only moves the countdowns on.
 */
export function renderOutlook(doc: Document, state: ColonyState, readAt: Date, now = readAt): void {
  for (const old of doc.querySelectorAll(`.${BADGE_CLASS}`)) old.remove();
  const { outlook: coming, balance } = computeOnce(state, readAt);
  const { famineAt, foodFullAt, materialsFullAt } = coming;

  const foodCell = doc.querySelector("#boiteInfo .jauge_nourriture")?.closest("td.tooltip_boite_info");
  // A warning when something is coming, otherwise the daily balance: the tooltip details it either way.
  const foodBadge = famineAt
    ? badge(doc, "Famine dans", famineAt, now)
    : foodFullAt
      ? badge(doc, "Entrepôt plein dans", foodFullAt, now)
      : balanceBadge(doc, state);
  if (foodCell) {
    foodBadge.dataset.optizzzTip = foodTooltip(state, balance, now);
    foodBadge.tabIndex = 0;
    for (const event of ["mouseover", "focusin"]) foodBadge.addEventListener(event, (e) => e.stopPropagation());
    foodCell.append(foodBadge);
  }

  const materialsCell = doc.querySelector("#boiteInfo .jauge_materiaux")?.closest("td.tooltip_boite_info");
  if (materialsCell && materialsFullAt) materialsCell.append(badge(doc, "Entrepôt plein dans", materialsFullAt, now));
}

function badge(doc: Document, label: string, at: Date, now: Date): HTMLElement {
  const remaining = Math.max(0, at.getTime() - now.getTime());
  const element = doc.createElement("div");
  element.className = BADGE_CLASS;
  const urgency = urgencyOf(remaining);
  if (urgency) element.classList.add(`${BADGE_CLASS}-${urgency}`);
  element.textContent = `${label} ${formatDuration(remaining)}`;
  return element;
}

function balanceBadge(doc: Document, state: ColonyState): HTMLElement {
  const element = doc.createElement("div");
  element.className = BADGE_CLASS;
  element.textContent = `Solde : ${signed(dailyBalance(state).food)} / jour`;
  return element;
}

const signed = (value: number) => `${value < 0 ? "−" : "+"}${formatNumber(Math.abs(value))}`;

function foodTooltip(state: ColonyState, balance: number | null, now: Date): string {
  const harvest = state.foodWorkers * HARVESTS_PER_DAY;
  const tax = (harvest + state.mushroomPerDay) * state.taxRate;

  const parts = [
    `Récolte ${signed(harvest)}`,
    `champignonnière ${signed(state.mushroomPerDay)}`,
    `armée ${signed(-state.armyPerDay)}`,
  ];
  if (tax > 0) parts.push(`pillage ${signed(-tax)}`);

  const lines = [
    `Nourriture par jour : ${signed(dailyBalance(state).food)}`,
    parts.join(", "),
    balance === null
      ? "Équilibre impossible même avec toutes les ouvrières sur la nourriture"
      : `Équilibre : ${formatNumber(balance)} ouvrières sur la nourriture`,
  ];
  if (!state.capacities) {
    lines.push("Capacité des entrepôts inconnue : ouvrez Construction pour être prévenu d'un entrepôt plein");
  }
  for (const hunt of state.hunts) {
    if (hunt.returnsAt > now) {
      lines.push(`Chasse de retour ${formatEndTime(hunt.returnsAt, now)} : +${formatNumber(hunt.fieldGain)} cm²`);
    }
  }
  return lines.join("\n");
}
