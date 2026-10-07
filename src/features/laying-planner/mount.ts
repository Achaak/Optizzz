import { formatNumber } from "@/utils/number-format";
import { formatDuration, formatEndTime } from "@/utils/time-format";
import type { Affordability, ColonyState } from "../resource-forecast/forecast";
import { maxAffordable, planLaying, readOrder, type LayingContext, type LayingRow } from "./laying";

export const LAYING_STYLE = `
.optizzz-laying { margin-top: 4px; font-size: 0.9em; line-height: 1.4; }
.optizzz-laying-negative { color: #c00; font-weight: bold; }
.optizzz-laying-max { display: flex; gap: 4px; align-items: center; margin-top: 2px; }
.optizzz-laying-max button, .optizzz-laying-max select { font: inherit; cursor: pointer; }`;

const MAX_DELAYS: { label: string; hours: number }[] = [
  { label: "maintenant", hours: 0 },
  { label: "dans 1 h", hours: 1 },
  { label: "dans 3 h", hours: 3 },
  { label: "dans 6 h", hours: 6 },
  { label: "dans 12 h", hours: 12 },
];

const signed = (value: number) => (value < 0 ? `−${formatNumber(-value)}` : `+${formatNumber(value)}`);

function payableText(affordability: Affordability, now: Date): string {
  switch (affordability.kind) {
    case "now":
      return "payable maintenant";
    case "at":
      return `payable dans ${formatDuration(affordability.at.getTime() - now.getTime())} (${formatEndTime(affordability.at, now)})`;
    case "warehouse":
      return `dépasse l'entrepôt de nourriture (${formatNumber(affordability.capacity)})`;
    case "never":
    case "workers":
      return "jamais payable au rythme actuel";
  }
}

/**
 * Under a unit's laying cost: when the typed order ends and can be paid, its upkeep, idle workers, and a « max »
 * button. Redrawn after each keystroke, once the game has updated its own cost (`maj_cout_ponte`).
 */
export function mountLayingPlan(row: LayingRow, state: ColonyState, context: LayingContext, clock: () => Date) {
  const doc = row.input.ownerDocument;
  const block = doc.createElement("div");
  block.className = "optizzz-laying";
  const plan = doc.createElement("div");
  plan.className = "optizzz-laying-plan";
  const upkeep = doc.createElement("div");
  upkeep.className = "optizzz-laying-upkeep";

  // Food of one unit: the game shows the cost of the number in `cout_nombre`, one while the field is empty.
  const shown = Number(doc.getElementById(`cout_nombre${row.suffix}`)?.textContent.replace(/\D/g, "") ?? "");
  const foodPerUnit = readOrder(row).food / Math.max(1, shown);

  const max = doc.createElement("div");
  max.className = "optizzz-laying-max";
  const button = doc.createElement("button");
  button.type = "button";
  button.textContent = "max";
  button.title = "Le plus grand nombre que la nourriture paie ; la ponte n'est pas lancée.";
  const delay = doc.createElement("select");
  for (const { label, hours } of MAX_DELAYS) {
    const option = doc.createElement("option");
    option.value = String(hours);
    option.textContent = label;
    delay.append(option);
  }
  button.addEventListener("click", () => {
    const now = clock();
    const by = new Date(now.getTime() + Number(delay.value) * 3_600_000);
    row.input.value = String(maxAffordable(foodPerUnit, state, by, now));
    // The game recomputes its cost on keyup.
    row.input.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));
    row.input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  max.append(button, delay);

  block.append(plan, upkeep, max);
  row.cell.append(block);

  const render = () => {
    const now = clock();
    const order = readOrder(row);
    if (order.count <= 0) {
      plan.textContent = "";
      upkeep.textContent = "";
      upkeep.className = "optizzz-laying-upkeep";
      return;
    }
    const laying = planLaying(order, state, context, now);
    plan.textContent = [
      laying.endsAt ? `fin ${formatEndTime(laying.endsAt, now)}` : null,
      payableText(laying.affordability, now),
    ]
      .filter(Boolean)
      .join(" · ");
    if (laying.idleWorkers !== null) {
      upkeep.textContent =
        laying.idleWorkers > 0
          ? `${formatNumber(laying.idleWorkers)} sans travail (TDC ${formatNumber(context.huntingField)})`
          : "toutes au travail";
      upkeep.className = "optizzz-laying-upkeep";
    } else {
      upkeep.textContent = `entretien +${formatNumber(laying.upkeepPerDay)} / jour · bilan ${signed(laying.balanceAfter)} / jour`;
      upkeep.className =
        laying.balanceAfter < 0 ? "optizzz-laying-upkeep optizzz-laying-negative" : "optizzz-laying-upkeep";
    }
  };
  // After the game's own handler has updated the cost.
  const later = () => setTimeout(render, 0);
  for (const event of ["keyup", "input", "change"]) row.input.addEventListener(event, later);
  doc.getElementById(`texte_destination${row.suffix}`)?.addEventListener("click", later);
  render();
  return { render };
}
