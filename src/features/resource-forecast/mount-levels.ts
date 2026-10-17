// « Niveaux suivants » under each row of construction.php and laboratoire.php: what the next levels cost and take,
// all together, and when the stock covers them. See docs/features/resource-forecast.md.
import { timeToAfford, type Affordability, type ColonyState } from "@/game/forecast";
import { sameName } from "@/game/levels";
import { readTimedRows, type Cost } from "@/game/pages/resources";
import { readWorkQueue } from "@/game/pages/work-queue";
import { levelsAhead, LEVEL_TIME_GROWTH } from "@/game/speed-up";
import { formatDecimal, formatNumber } from "@/utils/number-format";
import { placeInRow } from "@/utils/row-extras";
import { formatDuration, formatEndTime } from "@/utils/time-format";

const KIND = "optizzz-levels";
/** Beyond, the times are days long. */
const LEVELS = 5;
/** Its cost does not double from one level to the next. */
const IRREGULAR = ["Champignonnière"];

export const LEVELS_STYLE = `
.optizzz-levels { margin-top: var(--optizzz-space-2); }
.optizzz-levels table { width: auto; margin-top: var(--optizzz-space-2); }
.optizzz-levels :is(th, td) { white-space: nowrap; }
.optizzz-levels p { margin: var(--optizzz-space-2) 0 0; }`;

/** Columns of the resources the first level costs: buildings only take materials. */
const RESOURCES: [keyof Cost, string][] = [
  ["food", "Nourriture"],
  ["materials", "Matériaux"],
  ["workers", "Ouvrières"],
];

function describePaid(affordability: Affordability, now: Date): string {
  switch (affordability.kind) {
    case "now":
      return "maintenant";
    case "at":
      return formatEndTime(affordability.at, now);
    case "workers":
      return `manque ${formatNumber(affordability.missing)} ouvrières`;
    case "warehouse":
      return "entrepôt trop petit";
    case "never":
      return "jamais au rythme actuel";
  }
}

const cell = (doc: Document, tag: "th" | "td", text: string, numeric = false) => {
  const element = doc.createElement(tag);
  element.textContent = text;
  if (numeric) element.className = "optizzz-num";
  return element;
};

/** Adds the « Niveaux suivants » block to every row that can be raised. Built once: it only depends on the stock. */
export function renderLevelsAhead(
  doc: Document,
  state: ColonyState,
  kind: keyof typeof LEVEL_TIME_GROWTH,
  now: Date,
): void {
  const queued = readWorkQueue(doc, now).items;
  for (const row of readTimedRows(doc)) {
    if (row.locked || IRREGULAR.some((name) => sameName(name, row.name))) continue;
    // The row shows the cost of the level after those already queued.
    const done = Math.max(
      row.level,
      ...queued.filter((item) => sameName(item.name, row.name)).map((item) => item.targetLevel),
    );

    const resources = RESOURCES.filter(([resource]) => row.cost[resource] > 0);
    const growth = LEVEL_TIME_GROWTH[kind];

    const details = doc.createElement("details");
    details.className = "optizzz-disclosure";
    const summary = doc.createElement("summary");
    summary.textContent = `Coût des ${String(LEVELS)} niveaux suivants`;
    const table = doc.createElement("table");
    table.className = "optizzz-table optizzz-table--dense";
    const head = doc.createElement("tr");
    head.append(
      cell(doc, "th", "Jusqu'au niveau"),
      ...resources.map(([, title]) => cell(doc, "th", title, true)),
      cell(doc, "th", "Durée", true),
      cell(doc, "th", "Tout payable"),
    );
    const body = doc.createElement("tbody");
    for (const ahead of levelsAhead({ cost: row.cost, duration: row.duration, growth, count: LEVELS })) {
      const line = doc.createElement("tr");
      line.append(
        cell(doc, "td", String(done + ahead.levels), true),
        ...resources.map(([resource]) => cell(doc, "td", formatNumber(ahead.cost[resource]), true)),
        cell(doc, "td", formatDuration(ahead.duration), true),
        cell(doc, "td", describePaid(timeToAfford(state, ahead.cost, now), now)),
      );
      body.append(line);
    }
    const thead = doc.createElement("thead");
    thead.append(head);
    table.append(thead, body);
    const note = doc.createElement("p");
    note.className = "optizzz-note";
    note.textContent = `Cumuls estimés : coût × 2 et durée × ${formatDecimal(growth)} à chaque niveau, au bonus actuel. « Tout payable » ne compte pas la file d'attente.`;
    details.append(summary, table, note);
    placeInRow(row.description, KIND, details);
  }
}
