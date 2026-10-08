import { readSection } from "@/game/pages/end-times";
import type { Feature } from "../feature";
import { INCOME_MAX_AGE, loadCapacities, loadIncome } from "@/data/income";
import { readStock } from "@/game/pages/resources";
import { queuedWorkers, readLayingRows } from "./laying";
import { LAYING_STYLE, mountLayingNotice, mountLayingPlan } from "./mount";

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
    // The stock is the one read now: plans are computed at this time, only what is shown relative to now moves.
    const readAt = new Date();
    const style = document.createElement("style");
    style.textContent = LAYING_STYLE;
    document.head.append(style);
    const income = await loadIncome(location.origin, INCOME_MAX_AGE, readAt).catch((error: unknown) => {
      console.warn("[Optizzz] laying planner: income unreadable", error);
      return null;
    });
    if (!income) {
      mountLayingNotice(rows[0], "Prévisions de ponte indisponibles : la page Ressources n'a pas pu être lue.");
      return;
    }
    const state = { ...stock, ...income, capacities: await loadCapacities(location.origin, false) };

    // New layings wait for those already queued (their « Temps total restant » adds up along the queue).
    const queued = readSection(document, "laying", readAt)?.items ?? [];
    const queueEnd = new Date(Math.max(readAt.getTime(), ...queued.map((item) => item.endsAt.getTime())));
    const context = {
      queueEnd,
      huntingField: stock.huntingField,
      queuedWorkers: queuedWorkers(queued.map((item) => item.label)),
    };
    const plans = rows.map((row) => mountLayingPlan(row, state, context, readAt, () => new Date()));
    ctx.setInterval(() => {
      for (const plan of plans) plan.render();
    }, REFRESH_MS);
  },
};
