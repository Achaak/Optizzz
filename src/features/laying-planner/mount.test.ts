import { describe, expect, it, vi } from "vitest";
import type { ColonyState } from "@/game/forecast";
import reineHtml from "./__fixtures__/reine-form.html?raw";
import { readLayingRows, readLayingSpeed, type LayingRow } from "./laying";
import { mountLayingPlan, settingsStore } from "./mount";
import { DEFAULT_LAYING_SETTINGS } from "./settings";

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
const context = { queueEnd: now, huntingField: 4496, queuedWorkers: 0 };

const setup = () => {
  const doc = new DOMParser().parseFromString(reineHtml, "text/html");
  const [workers, dwarves] = readLayingRows(doc);
  if (!workers || !dwarves) throw new Error("fixture");
  const settings = settingsStore(DEFAULT_LAYING_SETTINGS, vi.fn());
  const options = { speed: readLayingSpeed(doc), settings };
  return { doc, workers, dwarves, settings, options };
};

const chip = (row: LayingRow, label: string) =>
  [...row.panel.querySelectorAll<HTMLButtonElement>(".optizzz-laying-chip")].find((button) =>
    button.textContent.startsWith(label),
  );
const tiles = (row: LayingRow) =>
  [...row.panel.querySelectorAll(".optizzz-laying-tile")].map((tile) =>
    [...tile.children].map((part) => part.textContent),
  );
const tile = (row: LayingRow, label: string) => tiles(row).find(([first]) => first === label);
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("mountLayingPlan", () => {
  it("sits in the description cell, out of the game's form, so that it never sends anything", () => {
    const { workers, options } = setup();
    mountLayingPlan(workers, state, context, now, () => now, options);
    const block = workers.panel.querySelector(".optizzz-laying");
    expect(block).not.toBeNull();
    expect(block?.closest("form")).toBeNull();
    expect(workers.cell.querySelector(".optizzz-laying")).toBeNull();
  });

  it("shows the chosen order in labelled tiles: count, cost, when payable, end, idle workers", () => {
    const { workers, options } = setup();
    mountLayingPlan(workers, state, context, now, () => now, options);
    expect(tile(workers, "Quantité")).toEqual(["Quantité", "200"]);
    expect(tile(workers, "Coût")).toEqual(["Coût", "1 000", "nourriture"]);
    expect(tile(workers, "Payable")).toEqual(["Payable", "maintenant"]);
    expect(tile(workers, "Fin de ponte")).toEqual(["Fin de ponte", "12 h 33"]);
    // 4 400 workers + 200 − 4 496 cm².
    expect(tile(workers, "Sans travail")).toEqual(["Sans travail", "104", "TDC 4 496"]);
  });

  it("explains the shortcuts while nothing is chosen", () => {
    const { dwarves, options } = setup();
    mountLayingPlan(dwarves, state, context, now, () => now, options);
    expect(tiles(dwarves)).toEqual([]);
    expect(dwarves.panel.querySelector(".optizzz-laying-summary")?.textContent).toContain("Survolez un raccourci");
  });

  it("writes each shortcut's number on it", () => {
    const { dwarves, options } = setup();
    mountLayingPlan(dwarves, state, context, now, () => now, options);
    // 2 000 food at 16 each; 50 s each.
    expect(chip(dwarves, "maintenant")?.textContent).toBe("maintenant125");
    expect(chip(dwarves, "1 h")?.textContent).toBe("1 h72");
  });

  it("previews a shortcut on hover, without touching the game's form", () => {
    const { dwarves, options } = setup();
    mountLayingPlan(dwarves, state, context, now, () => now, options);
    chip(dwarves, "maintenant")?.dispatchEvent(new MouseEvent("mouseenter"));
    expect(tile(dwarves, "Aperçu")).toEqual(["Aperçu", "125"]);
    expect(tile(dwarves, "Coût")?.[1]).toBe("2 000");
    expect(dwarves.input.value).toBe("");
    chip(dwarves, "maintenant")?.dispatchEvent(new MouseEvent("mouseleave"));
    expect(tiles(dwarves)).toEqual([]);
  });

  it("writes what there is to lay instead of a useless button", () => {
    const { workers, options } = setup();
    mountLayingPlan(workers, state, { ...context, huntingField: 4000 }, now, () => now, options);
    expect(chip(workers, "jusqu'au TDC")).toBeUndefined();
    expect(workers.panel.querySelector(".optizzz-laying-empty")?.textContent).toBe(
      "jusqu'au TDC : TDC plein, 400 sans travail",
    );
  });

  it("fills the game's field on click, and lets the game update its cost and slider", () => {
    const { dwarves, options } = setup();
    const keyup = vi.fn();
    dwarves.input.addEventListener("keyup", keyup);
    mountLayingPlan(dwarves, state, context, now, () => now, options);
    chip(dwarves, "maintenant")?.click();
    expect(dwarves.input.value).toBe("125");
    expect(keyup).toHaveBeenCalled();
  });

  it("shows the balance after laying with its upkeep, red when it falls below zero", async () => {
    const { doc, dwarves, options } = setup();
    mountLayingPlan(dwarves, { ...state, armyPerDay: 4790 }, context, now, () => now, options);
    dwarves.input.value = "10";
    const food = doc.getElementById("cout_nourriture1");
    if (food) food.textContent = "160";
    dwarves.input.dispatchEvent(new Event("input"));
    await tick();
    expect(tile(dwarves, "Bilan après")).toEqual(["Bilan après", "−14 / j", "entretien 24 / j"]);
    expect(dwarves.panel.querySelector(".optizzz-laying-negative")?.textContent).toBe("−14 / j");
  });

  it("follows the game's slider, which only changes the hidden count and the cost", async () => {
    const { doc, dwarves, options } = setup();
    mountLayingPlan(dwarves, state, context, now, () => now, options);
    const count = doc.getElementById("nombre_de_ponte1") as HTMLInputElement;
    count.value = "30";
    const food = doc.getElementById("cout_nourriture1");
    if (food) food.textContent = "480";
    await tick();
    expect(tile(dwarves, "Quantité")?.[1]).toBe("30");
    expect(tile(dwarves, "Bilan après")?.[2]).toBe("entretien 72 / j");
  });

  it("marks the shortcut matching the chosen order", () => {
    const { dwarves, options } = setup();
    const plan = mountLayingPlan(dwarves, state, context, now, () => now, options);
    dwarves.input.value = "72";
    const count = dwarves.input.ownerDocument.getElementById("nombre_de_ponte1") as HTMLInputElement;
    count.value = "72";
    plan.render();
    expect(chip(dwarves, "1 h")?.getAttribute("aria-pressed")).toBe("true");
    expect(chip(dwarves, "maintenant")?.getAttribute("aria-pressed")).toBe("false");
  });

  it("redraws every row's shortcuts when the player changes the hours", () => {
    const { workers, dwarves, settings, options } = setup();
    mountLayingPlan(workers, state, context, now, () => now, options);
    mountLayingPlan(dwarves, state, context, now, () => now, options);
    const form = dwarves.panel.querySelector("form");
    const pay = form?.querySelector<HTMLInputElement>('input[type="text"]');
    if (!form || !pay) throw new Error("settings form");
    pay.value = "6";
    form.dispatchEvent(new Event("change"));
    expect(settings.get().payDelays).toEqual([6]);
    expect(chip(workers, "dans 6 h")).toBeDefined();
    expect(chip(workers, "dans 3 h")).toBeUndefined();
    expect(workers.panel.querySelector<HTMLInputElement>('form input[type="text"]')?.value).toBe("6");
  });

  it("keeps the plan computed when the page was read: an hour later, the time left is an hour shorter", () => {
    const { dwarves, options } = setup();
    let clock = now;
    const plan = mountLayingPlan(dwarves, { ...state, food: 0 }, context, now, () => clock, options);
    dwarves.input.value = "10";
    const food = dwarves.input.ownerDocument.getElementById("cout_nourriture1");
    if (food) food.textContent = "160";
    plan.render();
    const before = tile(dwarves, "Payable");
    clock = new Date(now.getTime() + 60 * 60_000);
    plan.render();
    const after = tile(dwarves, "Payable");
    expect(before?.[1]).toMatch(/^dans/);
    expect(after?.[1]).not.toBe(before?.[1]);
    // The same instant, an hour closer.
    expect(after?.[2]).toBe(before?.[2]);
  });
});
