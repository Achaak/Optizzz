import { readSection } from "../end-times/sources";
import type { Feature } from "../feature";
import { INCOME_MAX_AGE, loadCapacities, loadIncome } from "../resource-forecast/income";
import { readStock } from "../resource-forecast/pages";
import { readLayingRows } from "./laying";
import { LAYING_STYLE, mountLayingPlan } from "./mount";

const REFRESH_MS = 60_000;

/**
 * On Reine.php, under each unit's laying cost: when the typed order ends and can be paid, its upkeep and a « max »
 * button. See docs/features/laying-planner.md.
 */
export const layingPlanner: Feature = {
  id: "laying-planner",
  toggle: "laying-planner",
  matches: (url) => url.pathname.toLowerCase() === "/reine.php",
  async run(ctx) {
    const stock = readStock(document);
    const rows = readLayingRows(document);
    if (!stock || rows.length === 0) return;
    const now = new Date();
    const income = await loadIncome(location.origin, INCOME_MAX_AGE, now);
    if (!income) return;
    const state = { ...stock, ...income, capacities: await loadCapacities(location.origin, false) };

    // New layings wait for those already queued (their « Temps total restant » adds up along the queue).
    const queued = readSection(document, "laying", now)?.items ?? [];
    const queueEnd = new Date(Math.max(now.getTime(), ...queued.map((item) => item.endsAt.getTime())));

    const style = document.createElement("style");
    style.textContent = LAYING_STYLE;
    document.head.append(style);
    const plans = rows.map((row) =>
      mountLayingPlan(row, state, { queueEnd, huntingField: stock.huntingField }, () => new Date()),
    );
    ctx.setInterval(() => {
      for (const plan of plans) plan.render();
    }, REFRESH_MS);
  },
};
