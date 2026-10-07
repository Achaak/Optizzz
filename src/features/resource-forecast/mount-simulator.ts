// Worker split simulator on Ressources.php: try a split, see the outlook, apply it through the game's form.
import { formatDuration } from "@/utils/time-format";
import { balancedFoodWorkers, outlook, withSplit, type ColonyState } from "./forecast";

const PANEL_CLASS = "optizzz-simulator";

/**
 * Mounts the simulator under the harvest summary of Ressources.php, starting from the game's split. `assignable` is
 * how many workers can harvest (one per cm² of hunting field); `clock` gives the current time.
 */
export function mountSimulator(doc: Document, state: ColonyState, assignable: number, clock: () => Date): HTMLElement {
  const working = assignable;

  const panel = doc.createElement("div");
  panel.className = PANEL_CLASS;
  panel.innerHTML = `
    <strong>Simuler une répartition</strong>
    <div class="${PANEL_CLASS}-split">
      <label>Nourriture <input type="number" name="optizzz-food" min="0" max="${String(working)}" /></label>
      <input type="range" name="optizzz-split" min="0" max="${String(working)}" aria-label="Répartition" />
      <label>Matériaux <input type="number" name="optizzz-materials" min="0" max="${String(working)}" /></label>
    </div>
    <div class="${PANEL_CLASS}-idle"></div>
    <div class="${PANEL_CLASS}-outlook"></div>
    <button type="button">Équilibre nourriture</button>
    <button type="button">Appliquer</button>`;

  const input = (name: string) => panel.querySelector<HTMLInputElement>(`[name="${name}"]`);
  const food = input("optizzz-food");
  const split = input("optizzz-split");
  const materials = input("optizzz-materials");
  const summary = panel.querySelector(`.${PANEL_CLASS}-outlook`);
  const [balanceButton, applyButton] = panel.querySelectorAll("button");
  if (!food || !split || !materials || !summary || !balanceButton || !applyButton) return panel;

  const idle = panel.querySelector(`.${PANEL_CLASS}-idle`);
  let foodWorkers = state.foodWorkers;
  let materialWorkers = state.materialWorkers;
  const count = (value: string) => Math.max(0, Math.round(Number(value)) || 0);
  const show = (foodValue: number, materialsValue: number) => {
    foodWorkers = Math.min(working, foodValue);
    materialWorkers = Math.min(working - foodWorkers, materialsValue);
    food.value = String(foodWorkers);
    split.value = String(foodWorkers);
    materials.value = String(materialWorkers);
    const idleWorkers = working - foodWorkers - materialWorkers;
    if (idle) idle.textContent = idleWorkers > 0 ? `${String(idleWorkers)} ouvrières sans travail` : "";
    summary.textContent = describeOutlook(withSplit(state, foodWorkers, materialWorkers), clock());
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
  balanceButton.addEventListener("click", () => {
    const balance = balancedFoodWorkers(state, clock(), working);
    if (balance !== null) show(balance, working - balance);
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

function describeOutlook(state: ColonyState, now: Date): string {
  const { famineAt, foodFullAt, materialsFullAt } = outlook(state, now);
  const until = (date: Date) => formatDuration(date.getTime() - now.getTime());
  const lines = [famineAt ? `Famine dans ${until(famineAt)}` : "Pas de famine"];
  if (foodFullAt) lines.push(`Entrepôt de nourriture plein dans ${until(foodFullAt)}`);
  if (materialsFullAt) lines.push(`Entrepôt de matériaux plein dans ${until(materialsFullAt)}`);
  return lines.join(" · ");
}
