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
  it("sits right under the daily summary of the harvest", () => {
    const { doc, panel } = setup();
    expect(panel.previousElementSibling).toBe(doc.querySelector("#nbNourriture")?.closest("p"));
  });

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

  it("starts from the game's split and shows idle workers apart", () => {
    const doc = parse(ressourcesHtml);
    const panel = mountSimulator(doc, state, 400, () => now);
    const value = (name: string) => panel.querySelector<HTMLInputElement>(`[name="${name}"]`)?.value;
    const idle = () => panel.querySelector(".optizzz-simulator-idle")?.textContent ?? "";
    expect(value("optizzz-food")).toBe("0");
    expect(value("optizzz-materials")).toBe("300");
    expect(idle()).toBe("100 ouvrières sans travail");

    // The balance point puts every idle worker to work.
    [...panel.querySelectorAll("button")].find((element) => element.textContent === "Équilibre nourriture")?.click();
    expect(value("optizzz-food")).toBe("100");
    expect(value("optizzz-materials")).toBe("300");
    expect(idle()).toBe("");
  });

  it("only takes from materials what food needs beyond the idle workers", () => {
    const doc = parse(ressourcesHtml);
    const panel = mountSimulator(doc, state, 400, () => now);
    const input = (name: string) => panel.querySelector<HTMLInputElement>(`[name="${name}"]`);
    type(input("optizzz-food"), "50");
    expect(input("optizzz-materials")?.value).toBe("300");
    type(input("optizzz-food"), "150");
    expect(input("optizzz-materials")?.value).toBe("250");
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

  it("compares daily food and materials, current against simulated", () => {
    const { panel, field } = setup();
    const daily = () =>
      [...panel.querySelectorAll(".optizzz-simulator-daily tbody tr")].map((row) =>
        [...row.querySelectorAll("th, td")].map((cell) => cell.textContent.trim()),
      );
    expect(daily()).toEqual([
      ["Nourriture", "−4 800", "−4 800", ""],
      ["Matériaux", "+14 400", "+14 400", ""],
    ]);
    type(field("optizzz-food"), "150");
    expect(daily()).toEqual([
      ["Nourriture", "−4 800", "+2 400", "+7 200"],
      ["Matériaux", "+14 400", "+7 200", "−7 200"],
    ]);
  });

  it("only applies a split that differs from the game's, and can go back to it", () => {
    const { field, button } = setup();
    expect(button("Appliquer")?.disabled).toBe(true);
    type(field("optizzz-food"), "120");
    expect(button("Appliquer")?.disabled).toBe(false);
    button("Revenir à l'actuel")?.click();
    expect(field("optizzz-food")?.value).toBe("0");
    expect(field("optizzz-materials")?.value).toBe("300");
    expect(button("Appliquer")?.disabled).toBe(true);
  });

  it("colours each outlook line by urgency", () => {
    const { panel, field } = setup();
    const lines = () =>
      [...panel.querySelectorAll(".optizzz-simulator-outlook > div")].map((line) => [line.className, line.textContent]);
    expect(lines()).toEqual([["optizzz-outlook-danger", "Famine dans 5 h 00"]]);
    type(field("optizzz-food"), "100");
    expect(lines()).toEqual([["optizzz-simulator-ok", "Pas de famine"]]);
  });

  it("draws the split as a bar, idle workers included", () => {
    const doc = parse(ressourcesHtml);
    const panel = mountSimulator(doc, state, 400, () => now);
    const width = (part: string) => panel.querySelector<HTMLElement>(`.optizzz-simulator-bar-${part}`)?.style.width;
    expect([width("food"), width("materials"), width("idle")]).toEqual(["0%", "75%", "25%"]);
  });
});
