import type { Feature } from "../feature";
import { isEnabled } from "../toggles";
import { readWorkQueue } from "@/game/pages/work-queue";
import type { ColonyState } from "@/game/forecast";
import { INCOME_MAX_AGE, loadCapacities, loadIncome } from "@/data/income";
import { renderCostForecasts } from "./mount-costs";
import { renderOutlook } from "./mount-outlook";
import { LEVELS_STYLE, renderLevelsAhead } from "./mount-levels";
import { HEADER_TIP_STYLE } from "@/utils/header-tip";
import { mountSimulator, SIMULATOR_STYLE } from "./mount-simulator";
import { readCapacities, readIncome, readStock, type Income } from "@/game/pages/resources";

const REFRESH_MS = 60_000;

const STYLE = `
.optizzz-forecast { margin-top: var(--optizzz-space-2); }
.optizzz-forecast::before { content: "⏳ "; }
.optizzz-outlook { font-size: 0.8em; line-height: 1.2; padding: 1px 0 2px; }
/* On the header's dark box: the light states (the simulator, on the parchment, takes optizzz-text-*) */
#boiteInfo .optizzz-outlook-warning { color: var(--optizzz-menu-warning); font-weight: bold; }
#boiteInfo .optizzz-outlook-danger { color: var(--optizzz-menu-danger); font-weight: bold; }
${HEADER_TIP_STYLE}`;

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
    const showLevels = isEnabled(toggles, "resource-forecast", "levels") && (onConstruction || onLaboratory);
    // Nothing to show here: no background fetch. What the page shows is kept by the collect feature.
    if (!showOutlook && !showCosts && !showSimulator && !showLevels) return;

    let income: Income | null;
    if (onResources) {
      income = readIncome(document, readAt);
    } else {
      // Costs pages want fresh figures; elsewhere, the header can live with a few minutes old ones. Without them
      // (session expired, game in maintenance, nothing remembered yet), nothing is shown.
      income = await loadIncome(url.origin, showCosts || showLevels ? 0 : INCOME_MAX_AGE, readAt).catch(
        (error: unknown) => {
          console.warn("[Optizzz] resource forecast: income unreadable", error);
          return null;
        },
      );
    }
    if (!income) return;

    const pageCapacities = readCapacities(document);
    const capacities = pageCapacities ?? (await loadCapacities(url.origin, onLaboratory));

    const state: ColonyState = { ...stock, ...income, capacities };
    const style = document.createElement("style");
    style.textContent = STYLE + SIMULATOR_STYLE + LEVELS_STYLE;
    document.head.append(style);

    const queue = showCosts ? readWorkQueue(document, readAt) : null;
    const render = (now: Date) => {
      if (showOutlook) renderOutlook(document, state, readAt, now);
      if (queue) renderCostForecasts(document, state, queue, readAt, now);
    };
    render(readAt);
    if (showLevels) renderLevelsAhead(document, state, onConstruction ? "construction" : "research", readAt);
    ctx.setInterval(() => {
      render(new Date());
    }, REFRESH_MS);

    if (showSimulator) {
      mountSimulator(document, state, Math.min(stock.huntingField, stock.workers), () => readAt);
    }
  },
};
