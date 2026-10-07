// Worker split simulator on Ressources.php: try a split, see the outlook, apply it through the game's form.
import { formatDuration } from "@/utils/time-format";
import { balancedFoodWorkers, outlook, withFoodWorkers, type ColonyState } from "./forecast";

const PANEL_CLASS = "optizzz-simulator";

/**
 * Mounts the simulator after the game's worker form. `assignable` is how many workers can harvest
 * (one per cm² of hunting field); `clock` gives the current time.
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

  let foodWorkers = state.foodWorkers;
  const show = (value: number) => {
    foodWorkers = Math.min(working, Math.max(0, Math.round(value) || 0));
    food.value = String(foodWorkers);
    split.value = String(foodWorkers);
    materials.value = String(working - foodWorkers);
    summary.textContent = describeOutlook(withFoodWorkers(state, foodWorkers, working), clock());
  };

  food.addEventListener("input", () => {
    show(Number(food.value));
  });
  split.addEventListener("input", () => {
    show(Number(split.value));
  });
  materials.addEventListener("input", () => {
    show(working - Number(materials.value));
  });
  balanceButton.addEventListener("click", () => {
    const balance = balancedFoodWorkers(state, clock(), working);
    if (balance !== null) show(balance);
  });
  applyButton.addEventListener("click", () => {
    const gameFood = doc.querySelector<HTMLInputElement>("#RecolteNourriture");
    const gameMaterials = doc.querySelector<HTMLInputElement>("#RecolteMateriaux");
    const submit = doc.querySelector<HTMLInputElement>("#ChangeRessource");
    if (!gameFood || !gameMaterials || !submit) return;
    gameFood.value = String(foodWorkers);
    gameMaterials.value = String(working - foodWorkers);
    submit.click();
  });

  show(foodWorkers);
  const form = doc.querySelector("#ChangeRessource")?.closest("form");
  if (form) form.after(panel);
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
