// The forecast line added to each cost table of construction.php and laboratoire.php.
import { formatNumber } from "@/utils/number-format";
import { formatDuration, formatEndTime } from "@/utils/time-format";
import type { WorkQueue } from "../work-queue/queue";
import { forecastFor, type ColonyState, type Forecast, type Resource } from "./forecast";
import { readCosts, type Cost } from "./pages";

const LINE_CLASS = "optizzz-forecast";
const RESOURCE_NAMES: Record<Resource, string> = { food: "nourriture", materials: "matériaux" };

/**
 * Adds (or redraws) a forecast line under the cost of every row that cannot be started right now.
 * `readAt` is when `state` was read (the page load); `now` only moves the countdowns on.
 */
export function renderCostForecasts(
  doc: Document,
  state: ColonyState,
  queue: WorkQueue | null,
  readAt: Date,
  now = readAt,
): void {
  for (const old of doc.querySelectorAll(`.${LINE_CLASS}`)) old.remove();

  for (const { cost, locked, costTable } of readCosts(doc)) {
    if (locked || !costTable) continue;
    const forecast = forecastFor(state, cost, queue, readAt);
    const text = describe(forecast, now);
    if (!text) continue;

    const line = doc.createElement("tr");
    line.className = LINE_CLASS;
    line.title = "Optizzz : estimation d'après tes récoltes, ta champignonnière et ton armée";
    const cell = doc.createElement("td");
    cell.colSpan = Math.max(1, costTable.rows[0]?.cells.length ?? 1);
    cell.append(text);
    const missing = describeMissing(state, cost, forecast);
    if (missing) {
      const detail = doc.createElement("small");
      detail.append(missing);
      cell.append(doc.createElement("br"), detail);
    }
    line.append(cell);
    (costTable.tBodies[0] ?? costTable).append(line);
  }
}

function describe({ affordability, readyAt, blockedBy }: Forecast, now: Date): string | null {
  switch (affordability.kind) {
    case "workers":
      return `Il manque ${formatNumber(affordability.missing)} ouvrières`;
    case "warehouse":
      return `Entrepôt trop petit (capacité ${formatNumber(affordability.capacity)})`;
    case "never":
      return "Jamais au rythme actuel";
    case "now":
    case "at": {
      if (!readyAt) return null;
      const remaining = Math.max(0, readyAt.getTime() - now.getTime());
      const when = `dans ${formatDuration(remaining)} (${formatEndTime(readyAt, now)})`;
      return blockedBy === "queue" ? `${when} · file pleine` : when;
    }
  }
}

function describeMissing(state: ColonyState, cost: Cost, { affordability }: Forecast): string | null {
  if (affordability.kind === "now" || affordability.kind === "workers" || affordability.kind === "warehouse")
    return null;
  const missing = (["food", "materials"] as const)
    .filter((resource) => cost[resource] > state[resource])
    .map((resource) => `${formatNumber(Math.ceil(cost[resource] - state[resource]))} ${RESOURCE_NAMES[resource]}`);
  return missing.length ? `Manque ${missing.join(", ")}` : null;
}
