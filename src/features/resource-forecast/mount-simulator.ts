// Worker split simulator on Ressources.php: try a split, see the outlook, apply it through the game's form.
import { formatNumber } from "@/utils/number-format";
import { formatDuration } from "@/utils/time-format";
import { balancedFoodWorkers, dailyBalance, outlook, withSplit, type ColonyState } from "@/game/forecast";
import { htmlElement } from "@/utils/html";
import { urgencyOf } from "@/utils/urgency";

const PANEL_CLASS = "optizzz-simulator";
// The game's own icons (same origin).
const FOOD_ICON = "/images/icone/icone_pomme.png";
const MATERIALS_ICON = "/images/icone/icone_bois.png";

/** Close to the game's boxes: brown border, red italic title, Verdana inherited. */
export const SIMULATOR_STYLE = `
.${PANEL_CLASS} { margin: 14px 0 6px; padding: 10px 12px; border: 1px solid var(--optizzz-border); background: var(--optizzz-surface-tint); }
.${PANEL_CLASS}-title { display: block; margin-bottom: 6px; color: var(--optizzz-title); font-size: 17px; font-style: italic; font-weight: bold; }
.${PANEL_CLASS}-split { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 4px 10px; }
.${PANEL_CLASS}-split label { display: flex; align-items: center; gap: 4px; white-space: nowrap; }
.${PANEL_CLASS}-split img { width: 18px; height: 18px; }
.${PANEL_CLASS}-split input[type="number"] { width: 80px; }
.${PANEL_CLASS}-split input[type="range"] { width: 100%; accent-color: var(--optizzz-materials); }
.${PANEL_CLASS}-bar { grid-column: 2; display: flex; height: 8px; border: 1px solid var(--optizzz-border); background: var(--optizzz-surface-raised); }
.${PANEL_CLASS}-bar-food { background: var(--optizzz-title); }
.${PANEL_CLASS}-bar-materials { background: var(--optizzz-materials); }
.${PANEL_CLASS}-bar-idle { background: repeating-linear-gradient(45deg, var(--optizzz-idle) 0 3px, var(--optizzz-idle-alt) 3px 6px); }
.${PANEL_CLASS}-idle { grid-column: 2; text-align: center; font-size: 0.85em; font-style: italic; }
.${PANEL_CLASS}-idle:empty { display: none; }
.${PANEL_CLASS}-daily { margin: 10px 0 6px; border-collapse: collapse; }
.${PANEL_CLASS}-daily th, .${PANEL_CLASS}-daily td { padding: 1px 10px 1px 0; text-align: right; }
.${PANEL_CLASS}-daily th:first-child { text-align: left; font-weight: normal; }
.${PANEL_CLASS}-daily thead th { font-size: 0.85em; font-weight: normal; font-style: italic; }
.${PANEL_CLASS}-up { color: var(--optizzz-food); font-weight: bold; }
.${PANEL_CLASS}-down { color: var(--optizzz-danger); font-weight: bold; }
.${PANEL_CLASS}-outlook { margin: 4px 0 8px; font-weight: bold; }
.${PANEL_CLASS}-ok { color: var(--optizzz-success); }
.${PANEL_CLASS}-actions { display: flex; gap: 6px; flex-wrap: wrap; }
.${PANEL_CLASS}-actions button:last-child { margin-left: auto; font-weight: bold; }`;

const signed = (value: number) => `${value < 0 ? "−" : "+"}${formatNumber(Math.abs(value))}`;

/**
 * Mounts the simulator under the harvest summary of Ressources.php, starting from the game's split.
 * `assignable` is how many workers can harvest (one per cm² of hunting field); `clock` gives the time.
 */
export function mountSimulator(doc: Document, state: ColonyState, assignable: number, clock: () => Date): HTMLElement {
  const working = assignable;
  const max = String(working);

  const panel = htmlElement(
    doc,
    "div",
    `<div class="${PANEL_CLASS}">
    <span class="${PANEL_CLASS}-title">Simulation de répartition</span>
    <div class="${PANEL_CLASS}-split">
      <label><img src="${FOOD_ICON}" alt="" />Nourriture
        <input type="number" name="optizzz-food" min="0" max="${max}" /></label>
      <input type="range" name="optizzz-split" min="0" max="${max}" aria-label="Répartition" />
      <label><input type="number" name="optizzz-materials" min="0" max="${max}" />
        Matériaux<img src="${MATERIALS_ICON}" alt="" /></label>
      <div class="${PANEL_CLASS}-bar" aria-hidden="true">
        <div class="${PANEL_CLASS}-bar-food"></div>
        <div class="${PANEL_CLASS}-bar-materials"></div>
        <div class="${PANEL_CLASS}-bar-idle"></div>
      </div>
      <div class="${PANEL_CLASS}-idle"></div>
    </div>
    <table class="${PANEL_CLASS}-daily">
      <thead><tr><th>Par jour</th><th>Actuel</th><th>Simulé</th><th></th></tr></thead>
      <tbody>
        <tr><th>Nourriture</th><td></td><td></td><td></td></tr>
        <tr><th>Matériaux</th><td></td><td></td><td></td></tr>
      </tbody>
    </table>
    <div class="${PANEL_CLASS}-outlook"></div>
    <div class="${PANEL_CLASS}-actions">
      <button type="button">Équilibre nourriture</button>
      <button type="button">Revenir à l'actuel</button>
      <button type="button">Appliquer</button>
    </div>
  </div>`,
  );

  const input = (name: string) => panel.querySelector<HTMLInputElement>(`[name="${name}"]`);
  const food = input("optizzz-food");
  const split = input("optizzz-split");
  const materials = input("optizzz-materials");
  const summary = panel.querySelector(`.${PANEL_CLASS}-outlook`);
  const idle = panel.querySelector(`.${PANEL_CLASS}-idle`);
  const dailyRows = [...panel.querySelectorAll(`.${PANEL_CLASS}-daily tbody tr`)];
  const [balanceButton, resetButton, applyButton] = panel.querySelectorAll("button");
  if (!food || !split || !materials || !summary || !balanceButton || !resetButton || !applyButton) return panel;

  const bar = (part: string) => panel.querySelector<HTMLElement>(`.${PANEL_CLASS}-bar-${part}`);
  const percent = (count: number) => `${String(working ? Math.round((count / working) * 100) : 0)}%`;
  const current = dailyBalance(state);

  let foodWorkers = state.foodWorkers;
  let materialWorkers = state.materialWorkers;
  const count = (value: string) => Math.max(0, Math.round(Number(value)) || 0);

  const show = (foodValue: number, materialsValue: number) => {
    foodWorkers = Math.min(working, foodValue);
    materialWorkers = Math.min(working - foodWorkers, materialsValue);
    const idleWorkers = working - foodWorkers - materialWorkers;
    food.value = String(foodWorkers);
    split.value = String(foodWorkers);
    materials.value = String(materialWorkers);

    const foodBar = bar("food");
    const materialsBar = bar("materials");
    const idleBar = bar("idle");
    if (foodBar) foodBar.style.width = percent(foodWorkers);
    if (materialsBar) materialsBar.style.width = percent(materialWorkers);
    if (idleBar) idleBar.style.width = percent(idleWorkers);
    if (idle) idle.textContent = idleWorkers > 0 ? `${formatNumber(idleWorkers)} ouvrières sans travail` : "";

    const simulated = withSplit(state, foodWorkers, materialWorkers);
    const daily = dailyBalance(simulated);
    (["food", "materials"] as const).forEach((resource, index) => {
      const [now, then, change] = dailyRows[index]?.querySelectorAll("td") ?? [];
      if (!now || !then || !change) return;
      const difference = Math.round(daily[resource] - current[resource]);
      now.textContent = signed(current[resource]);
      then.textContent = signed(daily[resource]);
      change.textContent = difference === 0 ? "" : signed(difference);
      change.className = difference > 0 ? `${PANEL_CLASS}-up` : difference < 0 ? `${PANEL_CLASS}-down` : "";
    });

    summary.replaceChildren(...outlookLines(doc, simulated, clock()));
    applyButton.disabled = foodWorkers === state.foodWorkers && materialWorkers === state.materialWorkers;
  };

  // Food takes idle workers first, then materials; the slider moves workers between the two.
  food.addEventListener("input", () => {
    const value = count(food.value);
    show(value, Math.min(materialWorkers, working - value));
  });
  materials.addEventListener("input", () => {
    const value = count(materials.value);
    show(Math.min(foodWorkers, working - value), value);
  });
  split.addEventListener("input", () => {
    const value = count(split.value);
    show(value, Math.max(0, foodWorkers + materialWorkers - value));
  });
  // When no split avoids famine, the button says so rather than doing nothing.
  if (balancedFoodWorkers(state, clock(), working) === null) {
    balanceButton.disabled = true;
    balanceButton.title = "Impossible : même toutes les ouvrières sur la nourriture ne suffisent pas.";
  }
  balanceButton.addEventListener("click", () => {
    const balance = balancedFoodWorkers(state, clock(), working);
    if (balance !== null) show(balance, working - balance);
  });
  resetButton.addEventListener("click", () => {
    show(state.foodWorkers, state.materialWorkers);
  });
  applyButton.addEventListener("click", () => {
    const gameFood = doc.querySelector<HTMLInputElement>("#RecolteNourriture");
    const gameMaterials = doc.querySelector<HTMLInputElement>("#RecolteMateriaux");
    const submit = doc.querySelector<HTMLInputElement>("#ChangeRessource");
    if (!gameFood || !gameMaterials || !submit) return;
    gameFood.value = String(foodWorkers);
    gameMaterials.value = String(materialWorkers);
    submit.click();
  });

  show(foodWorkers, materialWorkers);
  // Under the « Chaque jour, vous récoltez… » summary. The game's form is nested in a table, so it is
  // not an ancestor of its own fields: never place anything relative to it.
  const summaryParagraph = doc.querySelector("#nbNourriture")?.closest("p");
  if (summaryParagraph) summaryParagraph.after(panel);
  else doc.querySelector("#ChangeRessource")?.closest("table")?.after(panel);
  return panel;
}

/** One line per event to come, coloured by urgency. */
function outlookLines(doc: Document, state: ColonyState, now: Date): HTMLElement[] {
  const { famineAt, foodFullAt, materialsFullAt } = outlook(state, now);
  const line = (text: string, className: string) => {
    const element = doc.createElement("div");
    element.className = className;
    element.textContent = text;
    return element;
  };
  const timed = (label: string, at: Date) => {
    const remaining = at.getTime() - now.getTime();
    const urgency = urgencyOf(remaining);
    const className = urgency ? `optizzz-outlook-${urgency}` : "";
    return line(`${label} ${formatDuration(remaining)}`, className);
  };

  const lines = [famineAt ? timed("Famine dans", famineAt) : line("Pas de famine", `${PANEL_CLASS}-ok`)];
  if (foodFullAt) lines.push(timed("Entrepôt de nourriture plein dans", foodFullAt));
  if (materialsFullAt) lines.push(timed("Entrepôt de matériaux plein dans", materialsFullAt));
  return lines;
}
