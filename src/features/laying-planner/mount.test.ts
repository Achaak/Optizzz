import { describe, expect, it, vi } from "vitest";
import type { ColonyState } from "../resource-forecast/forecast";
import reineHtml from "./__fixtures__/reine-form.html?raw";
import { readLayingRows } from "./laying";
import { mountLayingPlan } from "./mount";

const now = new Date(2026, 9, 7, 12, 0, 0);
const state: ColonyState = {
  food: 2000,
  materials: 0,
  workers: 4400,
  capacities: { food: 50_000, materials: 50_000 },
  foodWorkers: 100,
  materialWorkers: 4300,
  mushroomPerDay: 0,
  armyPerDay: 2400,
  taxRate: 0,
  nextHarvestAt: new Date(now.getTime() + 30 * 60_000),
  hunts: [],
  newWorkersGoTo: "none",
};
const context = { queueEnd: now, huntingField: 4496 };

const setup = () => {
  const doc = new DOMParser().parseFromString(reineHtml, "text/html");
  const [workers, dwarves] = readLayingRows(doc);
  if (!workers || !dwarves) throw new Error("fixture");
  return { doc, workers, dwarves };
};

describe("mountLayingPlan", () => {
  it("tells when the order ends, that it can be paid, and how many workers will idle", () => {
    const { workers } = setup();
    mountLayingPlan(workers, state, context, () => now);
    expect(workers.cell.querySelector(".optizzz-laying")?.textContent).toContain(
      "fin aujourd'hui 12 h 33 · payable maintenant",
    );
    expect(workers.cell.textContent).toContain("104 sans travail (TDC 4 496)");
  });

  it("stays out of the game's form, so that it never sends anything", () => {
    const { workers } = setup();
    mountLayingPlan(workers, state, context, () => now);
    expect(workers.cell.querySelector(".optizzz-laying")?.closest("form")).toBeNull();
  });

  it("says nothing but the max button while no number is typed", () => {
    const { dwarves } = setup();
    mountLayingPlan(dwarves, state, context, () => now);
    expect(dwarves.cell.querySelector(".optizzz-laying-plan")?.textContent).toBe("");
    expect(dwarves.cell.querySelector(".optizzz-laying-max")).not.toBeNull();
  });

  it("fills the game's field with the most it can pay, and lets the game update its cost", () => {
    const { dwarves } = setup();
    const keyup = vi.fn();
    dwarves.input.addEventListener("keyup", keyup);
    mountLayingPlan(dwarves, state, context, () => now);
    dwarves.cell.querySelector<HTMLButtonElement>(".optizzz-laying-max button")?.click();
    // 2 000 food at 16 each.
    expect(dwarves.input.value).toBe("125");
    expect(keyup).toHaveBeenCalled();
  });

  it("shows the upkeep and the food balance after laying, red when it falls below zero", async () => {
    const { doc, dwarves } = setup();
    mountLayingPlan(dwarves, { ...state, armyPerDay: 4790 }, context, () => now);
    dwarves.input.value = "10";
    const food = doc.getElementById("cout_nourriture1");
    if (food) food.textContent = "160";
    dwarves.input.dispatchEvent(new Event("input"));
    await new Promise((resolve) => setTimeout(resolve, 0));
    const upkeep = dwarves.cell.querySelector(".optizzz-laying-upkeep");
    expect(upkeep?.textContent).toBe("entretien +24 / jour · bilan −14 / jour");
    expect(upkeep?.classList.contains("optizzz-laying-negative")).toBe(true);
  });
});
