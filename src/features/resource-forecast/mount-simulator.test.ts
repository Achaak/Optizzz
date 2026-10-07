import { describe, expect, it, vi } from "vitest";
import ressourcesHtml from "./__fixtures__/ressources.html?raw";
import type { ColonyState } from "./forecast";
import { mountSimulator } from "./mount-simulator";

const MINUTE = 60_000;
const now = new Date(2026, 9, 7, 12, 0);
const at = (minutes: number) => new Date(now.getTime() + minutes * MINUTE);
const parse = (html: string) => new DOMParser().parseFromString(html, "text/html");

// 300 working workers, all on materials; upkeep of 4 800 a day = 100 per half hour.
const state: ColonyState = {
  food: 1000,
  materials: 0,
  workers: 300,
  foodWorkers: 0,
  materialWorkers: 300,
  mushroomPerDay: 0,
  armyPerDay: 4800,
  taxRate: 0,
  nextHarvestAt: at(10),
  hunts: [],
  newWorkersGoTo: "none",
  capacities: null,
};

function setup() {
  const doc = parse(ressourcesHtml);
  const panel = mountSimulator(doc, state, 300, () => now);
  const field = (name: string) => panel.querySelector<HTMLInputElement>(`[name="${name}"]`);
  const button = (label: string) =>
    [...panel.querySelectorAll("button")].find((element) => element.textContent === label);
  const summary = () => panel.querySelector(".optizzz-simulator-outlook")?.textContent ?? "";
  return { doc, panel, field, button, summary };
}

function type(input: HTMLInputElement | null, value: string) {
  if (!input) throw new Error("missing input");
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("mountSimulator", () => {
  it("starts from the current split and its outlook", () => {
    const { field, summary } = setup();
    expect(field("optizzz-food")?.value).toBe("0");
    expect(field("optizzz-materials")?.value).toBe("300");
    expect(summary()).toContain("Famine dans 5 h 00");
  });

  it("recomputes the outlook as the split changes, keeping the total", () => {
    const { field, summary } = setup();
    type(field("optizzz-food"), "100");
    expect(field("optizzz-materials")?.value).toBe("200");
    expect(field("optizzz-split")?.value).toBe("100");
    expect(summary()).toContain("Pas de famine");

    type(field("optizzz-split"), "50");
    expect(field("optizzz-food")?.value).toBe("50");
    expect(field("optizzz-materials")?.value).toBe("250");
  });

  it("lets every assignable worker be placed, idle ones included", () => {
    const doc = parse(ressourcesHtml);
    const panel = mountSimulator(doc, state, 400, () => now);
    expect(panel.querySelector<HTMLInputElement>('[name="optizzz-materials"]')?.value).toBe("400");
    [...panel.querySelectorAll("button")].find((element) => element.textContent === "Équilibre nourriture")?.click();
    expect(panel.querySelector<HTMLInputElement>('[name="optizzz-food"]')?.value).toBe("100");
    expect(panel.querySelector<HTMLInputElement>('[name="optizzz-materials"]')?.value).toBe("300");
  });

  it("finds the balance point", () => {
    const { field, button } = setup();
    button("Équilibre nourriture")?.click();
    expect(field("optizzz-food")?.value).toBe("100");
    expect(field("optizzz-materials")?.value).toBe("200");
  });

  it("applies the split through the game's own form", () => {
    const { doc, field, button } = setup();
    const submit = doc.querySelector<HTMLInputElement>("#ChangeRessource");
    const click = vi.fn((event: Event) => {
      event.preventDefault();
    });
    submit?.addEventListener("click", click);

    type(field("optizzz-food"), "120");
    button("Appliquer")?.click();

    expect(doc.querySelector<HTMLInputElement>("#RecolteNourriture")?.value).toBe("120");
    expect(doc.querySelector<HTMLInputElement>("#RecolteMateriaux")?.value).toBe("180");
    expect(click).toHaveBeenCalledOnce();
  });
});
