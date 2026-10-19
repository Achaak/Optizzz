// The harvest of Ressources.php, reworked: one panel to split the workers between food and materials, see what
// each side yields per day and when food runs out or a warehouse fills up, then apply it through the game's form.
import { formatAmount, formatNumber } from "@/utils/number-format";
import { formatDuration } from "@/utils/time-format";
import { parseGameInteger } from "@/utils/game-number";
import { balancedFoodWorkers, HARVESTS_PER_DAY, outlook, withSplit, type ColonyState } from "@/game/forecast";
import type { Income } from "@/game/pages/resources";
import { htmlElement } from "@/utils/html";
import { urgencyOf } from "@/utils/urgency";

const PANEL_CLASS = "optizzz-simulator";
/** Put on the game's form and daily summary while the panel stands in for them. */
const REPLACED_CLASS = "optizzz-harvest-replaced";
// The game's own icons (same origin).
const FOOD_ICON = "/images/icone/icone_pomme.png";
const MATERIALS_ICON = "/images/icone/icone_bois.png";

type NewWorkersGoTo = Income["newWorkersGoTo"];
const GAME_CHOICE: Record<NewWorkersGoTo, string> = { food: "nourriture", materials: "materiaux", none: "rien" };

/** An inset panel of the design system (docs/design-system.md), inside the game's Récoltes box. */
export const SIMULATOR_STYLE = `
.${REPLACED_CLASS} { display: none !important; }
.${PANEL_CLASS} { margin: var(--optizzz-space-5) 0 var(--optizzz-space-3); text-align: left; }
.${PANEL_CLASS}-split { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: var(--optizzz-space-2) var(--optizzz-space-4); margin-top: var(--optizzz-space-3); }
.${PANEL_CLASS}-side { display: grid; gap: var(--optizzz-space-1); }
.${PANEL_CLASS}-side:last-of-type { justify-items: end; }
.${PANEL_CLASS}-side-name { display: flex; align-items: center; gap: var(--optizzz-space-2); font-weight: bold; }
.${PANEL_CLASS}-side-name img { width: 18px; height: 18px; }
.${PANEL_CLASS}-side input { width: 9ch; text-align: right; }
.${PANEL_CLASS}-share { font-variant-numeric: tabular-nums; }
.${PANEL_CLASS}-split input[type="range"] {
  --food: 0%; --assigned: 100%;
  appearance: none; width: 100%; height: var(--optizzz-space-5); margin: 0; background: transparent; cursor: pointer;
}
.${PANEL_CLASS}-split input[type="range"]::-webkit-slider-runnable-track {
  height: var(--optizzz-space-4); border: 1px solid var(--optizzz-border); border-radius: var(--optizzz-radius-pill);
  background: linear-gradient(to right, var(--optizzz-title) 0 var(--food), var(--optizzz-materials) var(--food) var(--assigned), var(--optizzz-idle) var(--assigned));
}
.${PANEL_CLASS}-split input[type="range"]::-moz-range-track {
  height: var(--optizzz-space-4); border: 1px solid var(--optizzz-border); border-radius: var(--optizzz-radius-pill);
  background: linear-gradient(to right, var(--optizzz-title) 0 var(--food), var(--optizzz-materials) var(--food) var(--assigned), var(--optizzz-idle) var(--assigned));
}
.${PANEL_CLASS}-split input[type="range"]::-webkit-slider-thumb {
  appearance: none; width: var(--optizzz-space-6); height: var(--optizzz-space-6); margin-top: calc(var(--optizzz-space-1) * -1 - 1px);
  border: 2px solid var(--optizzz-text); border-radius: 50%; background: var(--optizzz-surface-raised);
}
.${PANEL_CLASS}-split input[type="range"]::-moz-range-thumb {
  width: var(--optizzz-space-5); height: var(--optizzz-space-5);
  border: 2px solid var(--optizzz-text); border-radius: 50%; background: var(--optizzz-surface-raised);
}
.${PANEL_CLASS}-split input[type="range"]:focus-visible { outline: 2px solid var(--optizzz-selected); outline-offset: 2px; }
.${PANEL_CLASS}-idle { grid-column: 2; text-align: center; }
.${PANEL_CLASS}-presets { margin: var(--optizzz-space-4) 0; align-items: center; }
.${PANEL_CLASS}-daily { width: 100%; margin: 0 0 var(--optizzz-space-4); }
.${PANEL_CLASS}-daily :is(th, td):not(:first-child) { width: 30%; text-align: right; white-space: nowrap; }
.${PANEL_CLASS}-daily tbody th { font-weight: normal; text-align: left; }
.${PANEL_CLASS}-daily .${PANEL_CLASS}-total :is(th, td) { font-weight: bold; }
.${PANEL_CLASS}-daily td > div + div { margin-top: var(--optizzz-space-1); }
.${PANEL_CLASS}-ok { color: var(--optizzz-success-text); font-weight: bold; }
.${PANEL_CLASS}-auto { display: flex; flex-wrap: wrap; align-items: center; gap: var(--optizzz-space-3); margin-bottom: var(--optizzz-space-4); }
.${PANEL_CLASS}-auto img { width: 16px; height: 16px; vertical-align: -3px; }
.${PANEL_CLASS}-actions { display: flex; flex-wrap: wrap; align-items: center; gap: var(--optizzz-space-3) var(--optizzz-space-4); }
.${PANEL_CLASS}-change { flex: 1; }
.${PANEL_CLASS}-game-form { display: block; margin-top: var(--optizzz-space-3); }`;

const signed = (value: number) =>
  Math.round(value) === 0 ? "0" : `${value < 0 ? "−" : "+"}${formatAmount(Math.abs(value))}`;
const percent = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);

/**
 * Mounts the panel in place of the game's harvest form and daily summary on Ressources.php, starting from the
 * game's split. `assignable` is how many workers can harvest (one per cm² of hunting field); `clock` gives the time.
 */
export function mountSimulator(doc: Document, state: ColonyState, assignable: number, clock: () => Date): HTMLElement {
  const working = assignable;
  const gameChoices = [...doc.querySelectorAll<HTMLInputElement>('input[name="choixOuvriere"]')];
  const taxedBy = doc.querySelector("#nbNourritureMaitre")?.parentElement?.querySelector("a")?.textContent.trim();

  const panel = htmlElement(
    doc,
    "section",
    `<section class="${PANEL_CLASS} optizzz-panel optizzz-panel--inset" aria-label="Répartition des ouvrières">
    <div class="optizzz-panel-title">Répartition des ouvrières</div>
    <div class="optizzz-note">Faites glisser le curseur ou saisissez un nombre : le bilan se recalcule, rien ne change dans le jeu avant « Appliquer ».</div>
    <div class="${PANEL_CLASS}-split">
      <label class="${PANEL_CLASS}-side">
        <span class="${PANEL_CLASS}-side-name"><img src="${FOOD_ICON}" alt="" />Nourriture</span>
        <input type="text" inputmode="numeric" name="optizzz-food" autocomplete="off" />
        <span class="${PANEL_CLASS}-share optizzz-note" data-share="food"></span>
      </label>
      <input type="range" name="optizzz-split" min="0" max="${String(working)}" aria-label="Ouvrières sur la nourriture (à gauche) ou les matériaux (à droite)" />
      <label class="${PANEL_CLASS}-side">
        <span class="${PANEL_CLASS}-side-name">Matériaux<img src="${MATERIALS_ICON}" alt="" /></span>
        <input type="text" inputmode="numeric" name="optizzz-materials" autocomplete="off" />
        <span class="${PANEL_CLASS}-share optizzz-note" data-share="materials"></span>
      </label>
      <div class="${PANEL_CLASS}-idle optizzz-note" aria-live="polite"></div>
    </div>
    <div class="${PANEL_CLASS}-presets optizzz-chips" role="group" aria-label="Raccourcis">
      <span class="optizzz-note">Raccourcis :</span>
      <button type="button" class="optizzz-chip" data-preset="current">Répartition actuelle</button>
      <button type="button" class="optizzz-chip" data-preset="balance">Juste assez de nourriture</button>
    </div>
    <table class="${PANEL_CLASS}-daily optizzz-table">
      <thead><tr><th>Par jour</th><th>Nourriture</th><th>Matériaux</th></tr></thead>
      <tbody>
        <tr data-row="harvest"><th>Récolte du terrain</th><td></td><td></td></tr>
        <tr data-row="mushroom"><th>Champignonnière</th><td></td><td></td></tr>
        <tr data-row="army"><th>Armée</th><td></td><td></td></tr>
        <tr data-row="tax"><th></th><td></td><td></td></tr>
        <tr data-row="total" class="${PANEL_CLASS}-total"><th>Solde</th><td></td><td></td></tr>
        <tr data-row="outlook"><th>À venir</th><td></td><td></td></tr>
      </tbody>
    </table>
    <div class="${PANEL_CLASS}-auto" role="group" aria-label="Affectation automatique des ouvrières">
      <span title="Où vont les ouvrières qui trouvent du terrain libre, au retour d'une chasse">Nouvelles ouvrières :</span>
      <span class="optizzz-segmented">
        <button type="button" data-auto="food"><img src="${FOOD_ICON}" alt="" /> Nourriture</button>
        <button type="button" data-auto="materials"><img src="${MATERIALS_ICON}" alt="" /> Matériaux</button>
        <button type="button" data-auto="none">Sans travail</button>
      </span>
    </div>
    <div class="${PANEL_CLASS}-actions">
      <span class="${PANEL_CLASS}-change optizzz-note" aria-live="polite"></span>
      <button type="button" class="optizzz-button-primary">Appliquer</button>
    </div>
    <button type="button" class="${PANEL_CLASS}-game-form optizzz-button-link" aria-expanded="false">Afficher le formulaire du jeu</button>
  </section>`,
  );

  const input = (name: string) => panel.querySelector<HTMLInputElement>(`[name="${name}"]`);
  const food = input("optizzz-food");
  const split = input("optizzz-split");
  const materials = input("optizzz-materials");
  const idle = panel.querySelector(`.${PANEL_CLASS}-idle`);
  const change = panel.querySelector(`.${PANEL_CLASS}-change`);
  const applyButton = panel.querySelector<HTMLButtonElement>(".optizzz-button-primary");
  const gameFormButton = panel.querySelector<HTMLButtonElement>(`.${PANEL_CLASS}-game-form`);
  const presetButton = (preset: string) => panel.querySelector<HTMLButtonElement>(`[data-preset="${preset}"]`);
  const autoButtons = [...panel.querySelectorAll<HTMLButtonElement>("[data-auto]")];
  const row = (name: string) => panel.querySelector<HTMLTableRowElement>(`[data-row="${name}"]`);
  if (!food || !split || !materials || !idle || !change || !applyButton || !gameFormButton) return panel;

  const currentSheet = daySheet(state, state.foodWorkers, state.materialWorkers);
  const currentOutlook = outlook(state, clock());
  const balance = balancedFoodWorkers(state, clock(), working);

  let foodWorkers = state.foodWorkers;
  let materialWorkers = state.materialWorkers;
  let newWorkersGoTo = state.newWorkersGoTo;

  // Rows that never change: the mushrooms, the army and the tax line's label.
  const cells = (name: string) => [...(row(name)?.querySelectorAll("td") ?? [])];
  const [mushroomFood] = cells("mushroom");
  if (mushroomFood) mushroomFood.textContent = signed(state.mushroomPerDay);
  const [armyFood] = cells("army");
  if (armyFood) armyFood.textContent = signed(-state.armyPerDay);
  const taxLabel = row("tax")?.querySelector("th");
  if (state.taxRate > 0 && taxLabel) {
    const rate = `${String(Math.round(state.taxRate * 100))} %`;
    taxLabel.textContent = taxedBy ? `Pillage de ${taxedBy} (${rate})` : `Pillage (${rate})`;
  } else row("tax")?.remove();

  const share = (resource: string, count: number) => {
    const element = panel.querySelector(`[data-share="${resource}"]`);
    if (element) element.textContent = `${String(percent(count, working))} % des ouvrières`;
  };

  /** A number in the cell, and below it how far it moved from the current split. */
  const compared = (cell: HTMLElement | undefined, simulated: number, now: number) => {
    if (!cell) return;
    const value = doc.createElement("div");
    value.textContent = signed(simulated);
    const difference = Math.round(simulated - now);
    if (difference === 0) {
      cell.replaceChildren(value);
      return;
    }
    const delta = doc.createElement("div");
    // Neutral: a gain on one side is a loss on the other, the sign says which (docs/adr/0003-daltonisme.md).
    delta.className = "optizzz-note";
    delta.textContent = `${signed(difference)} par rapport à l'actuelle`;
    cell.replaceChildren(value, delta);
  };

  const changed = () =>
    foodWorkers !== state.foodWorkers ||
    materialWorkers !== state.materialWorkers ||
    (gameChoices.length > 0 && newWorkersGoTo !== state.newWorkersGoTo);

  const show = (foodValue: number, materialsValue: number) => {
    foodWorkers = Math.min(working, foodValue);
    materialWorkers = Math.min(working - foodWorkers, materialsValue);
    const idleWorkers = working - foodWorkers - materialWorkers;
    // The field being typed in keeps its text (and its caret); it is formatted when left.
    if (doc.activeElement !== food) food.value = formatNumber(foodWorkers);
    if (doc.activeElement !== materials) materials.value = formatNumber(materialWorkers);
    split.value = String(foodWorkers);
    split.style.setProperty("--food", `${String(working ? (foodWorkers / working) * 100 : 0)}%`);
    split.style.setProperty(
      "--assigned",
      `${String(working ? ((foodWorkers + materialWorkers) / working) * 100 : 0)}%`,
    );
    split.setAttribute(
      "aria-valuetext",
      `${formatAmount(foodWorkers)} sur la nourriture, ${formatAmount(materialWorkers)} sur les matériaux`,
    );
    share("food", foodWorkers);
    share("materials", materialWorkers);
    idle.textContent =
      idleWorkers > 0
        ? `${formatAmount(idleWorkers)} ouvrières sans travail : elles pourraient récolter, rien ne leur est attribué`
        : "";

    const simulated = { ...withSplit(state, foodWorkers, materialWorkers), newWorkersGoTo };
    const sheet = daySheet(state, foodWorkers, materialWorkers);
    // Only the balance says how far it moved: the lines above follow from it.
    for (const [name, resource] of [
      ["harvest", "Harvest"],
      ["tax", "Tax"],
    ] as const) {
      const [foodCell, materialsCell] = cells(name);
      if (foodCell) foodCell.textContent = signed(sheet[`food${resource}`]);
      if (materialsCell) materialsCell.textContent = signed(sheet[`materials${resource}`]);
    }
    const [totalFood, totalMaterials] = cells("total");
    compared(totalFood, sheet.foodTotal, currentSheet.foodTotal);
    compared(totalMaterials, sheet.materialsTotal, currentSheet.materialsTotal);
    const [outlookFood, outlookMaterials] = cells("outlook");
    const events = outlook(simulated, clock());
    outlookFood?.replaceChildren(...foodOutlook(doc, events, currentOutlook, clock()));
    outlookMaterials?.replaceChildren(
      ...materialsOutlook(doc, events, currentOutlook, clock(), state.capacities !== null),
    );

    presetButton("current")?.setAttribute(
      "aria-pressed",
      String(foodWorkers === state.foodWorkers && materialWorkers === state.materialWorkers),
    );
    presetButton("balance")?.setAttribute(
      "aria-pressed",
      String(balance !== null && foodWorkers === balance && materialWorkers === working - balance),
    );
    for (const button of autoButtons)
      button.setAttribute("aria-pressed", String(button.dataset.auto === newWorkersGoTo));

    applyButton.disabled = !changed();
    change.textContent = changeSummary(state, foodWorkers, materialWorkers, newWorkersGoTo, gameChoices.length > 0);
  };

  const count = (value: string) => Math.max(0, parseGameInteger(value));
  // Food takes idle workers first, then materials; the slider moves workers between the two.
  food.addEventListener("input", () => {
    const value = Math.min(working, count(food.value));
    show(value, Math.min(materialWorkers, working - value));
  });
  materials.addEventListener("input", () => {
    const value = Math.min(working, count(materials.value));
    show(Math.min(foodWorkers, working - value), value);
  });
  for (const field of [food, materials]) {
    field.addEventListener("change", () => {
      show(foodWorkers, materialWorkers);
    });
    field.addEventListener("blur", () => {
      show(foodWorkers, materialWorkers);
    });
  }
  split.addEventListener("input", () => {
    const value = count(split.value);
    show(value, Math.max(0, foodWorkers + materialWorkers - value));
  });

  presetButton("current")?.addEventListener("click", () => {
    show(state.foodWorkers, state.materialWorkers);
  });
  const balanceButton = presetButton("balance");
  if (balanceButton) {
    balanceButton.title =
      balance === null
        ? "Impossible : même toutes les ouvrières sur la nourriture ne suffisent pas."
        : "Le moins d'ouvrières possible sur la nourriture sans jamais tomber à zéro (retours de chasse compris), toutes les autres sur les matériaux.";
    balanceButton.disabled = balance === null;
    balanceButton.addEventListener("click", () => {
      if (balance !== null) show(balance, working - balance);
    });
  }

  if (gameChoices.length === 0) panel.querySelector(`.${PANEL_CLASS}-auto`)?.remove();
  for (const button of autoButtons) {
    button.addEventListener("click", () => {
      newWorkersGoTo = (button.dataset.auto ?? "none") as NewWorkersGoTo;
      show(foodWorkers, materialWorkers);
    });
  }

  applyButton.addEventListener("click", () => {
    const gameFood = doc.querySelector<HTMLInputElement>("#RecolteNourriture");
    const gameMaterials = doc.querySelector<HTMLInputElement>("#RecolteMateriaux");
    const submit = doc.querySelector<HTMLInputElement>("#ChangeRessource");
    if (!gameFood || !gameMaterials || !submit) return;
    gameFood.value = String(foodWorkers);
    gameMaterials.value = String(materialWorkers);
    for (const choice of gameChoices) choice.checked = choice.value === GAME_CHOICE[newWorkersGoTo];
    submit.click();
  });

  show(foodWorkers, materialWorkers);

  // Under the « Chaque jour, vous récoltez… » summary, which the panel then stands in for, with the game's form.
  // The game's form is nested in a table, so it is not an ancestor of its own fields: never place anything
  // relative to it.
  const summaryParagraph = doc.querySelector("#nbNourriture")?.closest("p");
  // The form sits in a <center> with empty paragraphs around it: hide them all.
  const formTable = doc.querySelector("#ChangeRessource")?.closest("table");
  const gameForm = formTable?.closest("center") ?? formTable;
  if (summaryParagraph) summaryParagraph.after(panel);
  else gameForm?.after(panel);
  // The game leaves a line break between its form and its summary.
  const lineBreak = gameForm?.nextElementSibling?.localName === "br" ? gameForm.nextElementSibling : null;
  const replaced = [summaryParagraph, gameForm, lineBreak].filter((element) => !!element);
  for (const element of replaced) element.classList.add(REPLACED_CLASS);
  if (replaced.length === 0) gameFormButton.remove();
  gameFormButton.addEventListener("click", () => {
    const shown = gameFormButton.getAttribute("aria-expanded") === "true";
    for (const element of replaced) element.classList.toggle(REPLACED_CLASS, shown);
    gameFormButton.setAttribute("aria-expanded", String(!shown));
    gameFormButton.textContent = shown ? "Afficher le formulaire du jeu" : "Masquer le formulaire du jeu";
  });
  return panel;
}

/**
 * A day of harvest with `foodWorkers` and `materialWorkers`, line by line as the game writes it: the tribute
 * is rounded down, so the lines add up to the balance.
 */
function daySheet(state: ColonyState, foodWorkers: number, materialWorkers: number) {
  const foodHarvest = foodWorkers * HARVESTS_PER_DAY;
  const materialsHarvest = materialWorkers * HARVESTS_PER_DAY;
  const foodTax = -Math.floor((foodHarvest + state.mushroomPerDay) * state.taxRate);
  const materialsTax = -Math.floor(materialsHarvest * state.taxRate);
  return {
    foodHarvest,
    materialsHarvest,
    foodTax,
    materialsTax,
    foodTotal: foodHarvest + state.mushroomPerDay - state.armyPerDay + foodTax,
    materialsTotal: materialsHarvest + materialsTax,
  };
}

/** What « Appliquer » would change, in words. */
function changeSummary(
  state: ColonyState,
  foodWorkers: number,
  materialWorkers: number,
  newWorkersGoTo: NewWorkersGoTo,
  hasAutoChoice: boolean,
): string {
  const moves: string[] = [];
  const move = (label: string, from: number, to: number) => {
    if (from !== to) moves.push(`${label} ${formatAmount(from)} → ${formatAmount(to)}`);
  };
  move("nourriture", state.foodWorkers, foodWorkers);
  move("matériaux", state.materialWorkers, materialWorkers);
  if (hasAutoChoice && newWorkersGoTo !== state.newWorkersGoTo) {
    moves.push(`nouvelles ouvrières : ${AUTO_LABEL[newWorkersGoTo]}`);
  }
  if (moves.length === 0) return "C'est la répartition actuelle du jeu.";
  return `À appliquer : ${moves.join(", ")}.`;
}

const AUTO_LABEL: Record<NewWorkersGoTo, string> = { food: "nourriture", materials: "matériaux", none: "sans travail" };

type Events = ReturnType<typeof outlook>;

function line(doc: Document, text: string, className = ""): HTMLElement {
  const element = doc.createElement("div");
  element.className = className;
  element.textContent = text;
  return element;
}

/** « Famine dans 5 h », coloured by urgency, with what it is with the current split when that differs. */
function timed(doc: Document, label: string, at: Date, before: Date | null, now: Date): HTMLElement[] {
  const remaining = at.getTime() - now.getTime();
  const urgency = urgencyOf(remaining);
  const lines = [
    line(
      doc,
      `${label} dans ${formatDuration(remaining)}`,
      urgency ? `optizzz-text-${urgency} optizzz-outlook-${urgency}` : "",
    ),
  ];
  const wasDifferent = before?.getTime() !== at.getTime();
  if (wasDifferent) {
    const was = before ? `dans ${formatDuration(before.getTime() - now.getTime())}` : "jamais";
    lines.push(line(doc, `actuellement : ${was}`, "optizzz-note"));
  }
  return lines;
}

function foodOutlook(doc: Document, events: Events, before: Events, now: Date): HTMLElement[] {
  const lines = events.famineAt
    ? timed(doc, "Famine", events.famineAt, before.famineAt, now)
    : [line(doc, "Pas de famine", `${PANEL_CLASS}-ok`)];
  if (!events.famineAt && before.famineAt) {
    lines.push(
      line(
        doc,
        `actuellement : famine dans ${formatDuration(before.famineAt.getTime() - now.getTime())}`,
        "optizzz-note",
      ),
    );
  }
  if (events.foodFullAt) lines.push(...timed(doc, "Entrepôt plein", events.foodFullAt, before.foodFullAt, now));
  return lines;
}

function materialsOutlook(doc: Document, events: Events, before: Events, now: Date, known: boolean): HTMLElement[] {
  if (events.materialsFullAt) return timed(doc, "Entrepôt plein", events.materialsFullAt, before.materialsFullAt, now);
  if (!known) return [line(doc, "Capacité de l'entrepôt inconnue : ouvrez Construction", "optizzz-note")];
  return [line(doc, "Entrepôt jamais plein", "optizzz-muted")];
}
