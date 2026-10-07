import type { Feature } from "../feature";
import { isEnabled } from "../toggles";
import { readWorkQueue } from "../work-queue/queue";
import type { ColonyState } from "./forecast";
import { INCOME_MAX_AGE, loadCapacities, loadIncome, storeCapacities, storeIncome } from "./income";
import { renderCostForecasts } from "./mount-costs";
import { renderOutlook } from "./mount-outlook";
import { mountSimulator, SIMULATOR_STYLE } from "./mount-simulator";
import { readCapacities, readIncome, readStock, type Income } from "./pages";

const REFRESH_MS = 60_000;

const STYLE = `
.optizzz-forecast { margin-top: 4px; font-weight: bold; }
.optizzz-forecast::before { content: "⏳ "; }
.optizzz-outlook { font-size: 0.8em; line-height: 1.2; padding: 1px 0 2px; }
.optizzz-outlook-warning { color: #c76b00; font-weight: bold; }
.optizzz-outlook-danger { color: #c00; font-weight: bold; }`;

const page = (url: URL) => url.pathname.toLowerCase();

/**
 * When buildings and research become affordable, famine and full warehouses in the header, and a worker
 * split simulator on Ressources.php. See docs/features/resource-forecast.md.
 */
export const resourceForecast: Feature = {
  id: "resource-forecast",
  toggle: "resource-forecast",
  matches: () => true,
  async run(ctx, toggles) {
    const stock = readStock(document);
    if (!stock) return;
    const url = new URL(location.href);
    const readAt = new Date();
    const path = page(url);
    const onConstruction = path === "/construction.php";
    const onLaboratory = path === "/laboratoire.php";
    const onResources = path === "/ressources.php";
    const showOutlook = isEnabled(toggles, "resource-forecast", "outlook");
    const showCosts = isEnabled(toggles, "resource-forecast", "costs") && (onConstruction || onLaboratory);
    const showSimulator = isEnabled(toggles, "resource-forecast", "simulator") && onResources;
    // Nothing to show here: no background fetch. Ressources.php still stores its figures for other pages.
    if (!showOutlook && !showCosts && !onResources) return;

    let income: Income | null;
    if (onResources) {
      income = readIncome(document, readAt);
      if (income) await storeIncome(url.origin, income, readAt);
    } else {
      // Costs pages want fresh figures; elsewhere, the header can live with a few minutes old ones.
      income = await loadIncome(url.origin, showCosts ? 0 : INCOME_MAX_AGE, readAt);
    }
    if (!income) return;

    const pageCapacities = readCapacities(document);
    if (pageCapacities) await storeCapacities(url.origin, pageCapacities);
    const capacities = pageCapacities ?? (await loadCapacities(url.origin, onLaboratory));

    const state: ColonyState = { ...stock, ...income, capacities };
    const style = document.createElement("style");
    style.textContent = STYLE + SIMULATOR_STYLE;
    document.head.append(style);

    const queue = showCosts ? readWorkQueue(document, readAt) : null;
    const render = (now: Date) => {
      if (showOutlook) renderOutlook(document, state, readAt, now);
      if (queue) renderCostForecasts(document, state, queue, readAt, now);
    };
    render(readAt);
    ctx.setInterval(() => {
      render(new Date());
    }, REFRESH_MS);

    if (showSimulator) {
      mountSimulator(document, state, Math.min(stock.huntingField, stock.workers), () => readAt);
    }
  },
};
