// The forecast line added to each row of construction.php and laboratoire.php, under its description.
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

  for (const { cost, locked, description } of readCosts(doc)) {
    if (locked || !description) continue;
    const forecast = forecastFor(state, cost, queue, readAt);
    const parts = [describe(forecast, now), describeMissing(state, cost, forecast)].filter(Boolean);
    if (!parts[0]) continue;

    const line = doc.createElement("div");
    line.className = LINE_CLASS;
    line.title = "Optizzz : estimation d'après tes récoltes, ta champignonnière et ton armée";
    line.textContent = parts.join(" · ");
    description.append(line);
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
      return blockedBy === "queue" ? `Disponible ${when} · file pleine` : `Disponible ${when}`;
    }
  }
}

function describeMissing(state: ColonyState, cost: Cost, { affordability }: Forecast): string | null {
  if (affordability.kind === "now" || affordability.kind === "workers" || affordability.kind === "warehouse")
    return null;
  const missing = (["food", "materials"] as const)
    .filter((resource) => cost[resource] > state[resource])
    .map((resource) => `${formatNumber(Math.ceil(cost[resource] - state[resource]))} ${RESOURCE_NAMES[resource]}`);
  return missing.length ? `manque ${missing.join(", ")}` : null;
}
