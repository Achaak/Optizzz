import type { Feature } from "../feature";
import { readWorkQueue } from "../work-queue/queue";
import type { ColonyState } from "./forecast";
import { INCOME_MAX_AGE, loadCapacities, loadIncome, storeCapacities, storeIncome } from "./income";
import { renderCostForecasts } from "./mount-costs";
import { renderOutlook } from "./mount-outlook";
import { mountSimulator } from "./mount-simulator";
import { readCapacities, readIncome, readStock, type Income } from "./pages";

const REFRESH_MS = 60_000;

const STYLE = `
.optizzz-forecast td { font-size: 0.9em; padding-top: 2px; }
.optizzz-forecast small { opacity: 0.8; }
.optizzz-outlook { font-size: 0.8em; line-height: 1.2; padding: 1px 0 2px; }
.optizzz-outlook-warning { color: #c76b00; font-weight: bold; }
.optizzz-outlook-danger { color: #c00; font-weight: bold; }
.optizzz-simulator { margin: 12px 0; padding: 8px; border: 1px solid #000; }
.optizzz-simulator-split { display: flex; align-items: center; gap: 8px; margin: 6px 0; flex-wrap: wrap; }
.optizzz-simulator-split input[type="number"] { width: 80px; }
.optizzz-simulator-split input[type="range"] { flex: 1; min-width: 120px; }
.optizzz-simulator-outlook { margin: 6px 0; font-weight: bold; }
.optizzz-simulator button { margin-right: 6px; }`;

const page = (url: URL) => url.pathname.toLowerCase();

/**
 * When buildings and research become affordable, famine and full warehouses in the header, and a worker
 * split simulator on Ressources.php. See docs/features/resource-forecast.md.
 */
export const resourceForecast: Feature = {
  id: "resource-forecast",
  matches: () => true,
  async run(ctx) {
    const stock = readStock(document);
    if (!stock) return;
    const url = new URL(location.href);
    const readAt = new Date();
    const path = page(url);
    const onConstruction = path === "/construction.php";
    const onLaboratory = path === "/laboratoire.php";

    let income: Income | null;
    if (path === "/ressources.php") {
      income = readIncome(document, readAt);
      if (income) await storeIncome(url.origin, income, readAt);
    } else {
      // Costs pages want fresh figures; elsewhere, the header can live with a few minutes old ones.
      income = await loadIncome(url.origin, onConstruction || onLaboratory ? 0 : INCOME_MAX_AGE, readAt);
    }
    if (!income) return;

    const pageCapacities = readCapacities(document);
    if (pageCapacities) await storeCapacities(url.origin, pageCapacities);
    const capacities = pageCapacities ?? (await loadCapacities(url.origin, onLaboratory));

    const state: ColonyState = { ...stock, ...income, capacities };
    const style = document.createElement("style");
    style.textContent = STYLE;
    document.head.append(style);

    const queue = onConstruction || onLaboratory ? readWorkQueue(document, readAt) : null;
    const render = (now: Date) => {
      renderOutlook(document, state, readAt, now);
      if (queue) renderCostForecasts(document, state, queue, readAt, now);
    };
    render(readAt);
    ctx.setInterval(() => {
      render(new Date());
    }, REFRESH_MS);

    if (path === "/ressources.php") {
      mountSimulator(document, state, Math.min(stock.huntingField, stock.workers), () => readAt);
    }
  },
};
