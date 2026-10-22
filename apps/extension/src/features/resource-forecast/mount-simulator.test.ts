import { describe, expect, it, vi } from "vitest";
import ressourcesHtml from "@optizzz/game/pages/__fixtures__/ressources.html?raw";
import type { ColonyState } from "@optizzz/game/forecast";
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
  newWorkersGoTo: "materials",
  capacities: null,
};

function setup(colony: ColonyState = state, assignable = 300) {
  const doc = parse(ressourcesHtml);
  const panel = mountSimulator(doc, colony, assignable, () => now);
  const field = (name: string) => panel.querySelector<HTMLInputElement>(`[name="${name}"]`);
  const value = (name: string) => field(name)?.value;
  const button = (label: string) =>
    [...panel.querySelectorAll("button")].find((element) => element.textContent.trim() === label);
  const rows = () =>
    [...panel.querySelectorAll(".optizzz-simulator-daily tbody tr")].map((row) =>
      [...row.querySelectorAll("th, td")].map((cell) =>
        [...cell.childNodes].map((child) => (child.textContent ?? "").trim()).join(" | "),
      ),
    );
  const idle = () => panel.querySelector(".optizzz-simulator-idle")?.textContent ?? "";
  const change = () => panel.querySelector(".optizzz-simulator-change")?.textContent ?? "";
  return { doc, panel, field, value, button, rows, idle, change };
}

function type(input: HTMLInputElement | null, value: string) {
  if (!input) throw new Error("missing input");
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("mountSimulator", () => {
  it("stands in for the game's form and daily summary, which stay one click away", () => {
    const { doc, panel, button } = setup();
    const summary = doc.querySelector("#nbNourriture")?.closest("p");
    expect(panel.previousElementSibling).toBe(summary);
    expect(summary?.classList).toContain("optizzz-harvest-replaced");

    button("Afficher le formulaire du jeu")?.click();
    expect(summary?.classList).not.toContain("optizzz-harvest-replaced");
    expect(button("Masquer le formulaire du jeu")).toBeDefined();
  });

  it("starts from the current split, written like the game", () => {
    const { value, button, change } = setup(state, 3000);
    expect(value("optizzz-food")).toBe("0");
    expect(value("optizzz-materials")).toBe("300");
    expect(button("Répartition actuelle")?.getAttribute("aria-pressed")).toBe("true");
    expect(button("Appliquer")?.disabled).toBe(true);
    expect(change()).toBe("C'est la répartition actuelle du jeu.");
  });

  it("formats large numbers with thousands separators", () => {
    const { value } = setup({ ...state, materialWorkers: 108_966, workers: 108_966 }, 108_966);
    expect(value("optizzz-materials")).toBe("108 966");
  });

  it("moves workers between the two sides, keeping the total", () => {
    const { field, value } = setup();
    type(field("optizzz-food"), "100");
    expect(value("optizzz-materials")).toBe("200");
    expect(value("optizzz-split")).toBe("100");

    type(field("optizzz-split"), "50");
    expect(value("optizzz-food")).toBe("50");
    expect(value("optizzz-materials")).toBe("250");
  });

  it("reads what is typed like a game number", () => {
    const { field, value } = setup();
    type(field("optizzz-food"), "1 20");
    expect(value("optizzz-materials")).toBe("180");
  });

  it("shows idle workers apart, and food takes them first", () => {
    const { field, value, idle, button } = setup(state, 400);
    expect(idle()).toContain("100 ouvrières sans travail");
    type(field("optizzz-food"), "50");
    expect(value("optizzz-materials")).toBe("300");
    type(field("optizzz-food"), "150");
    expect(value("optizzz-materials")).toBe("250");

    // The balance point puts every idle worker to work.
    button("Juste assez de nourriture")?.click();
    expect(value("optizzz-food")).toBe("100");
    expect(value("optizzz-materials")).toBe("300");
    expect(idle()).toBe("");
  });

  it("finds the balance point and says when it is the one shown", () => {
    const { value, button } = setup();
    button("Juste assez de nourriture")?.click();
    expect(value("optizzz-food")).toBe("100");
    expect(value("optizzz-materials")).toBe("200");
    expect(button("Juste assez de nourriture")?.getAttribute("aria-pressed")).toBe("true");
    expect(button("Répartition actuelle")?.getAttribute("aria-pressed")).toBe("false");

    button("Répartition actuelle")?.click();
    expect(value("optizzz-food")).toBe("0");
    expect(button("Appliquer")?.disabled).toBe(true);
  });

  it("disables the balance point when no split avoids famine", () => {
    const { button } = setup({ ...state, armyPerDay: 1_000_000 });
    expect(button("Juste assez de nourriture")?.disabled).toBe(true);
  });

  it("details each day per resource, with the change from the current split", () => {
    const { field, rows } = setup();
    expect(rows().slice(0, 4)).toEqual([
      ["Récolte du terrain", "0", "+14 400"],
      ["Champignonnière", "0", ""],
      ["Armée", "−4 800", ""],
      ["Solde", "−4 800", "+14 400"],
    ]);
    type(field("optizzz-food"), "150");
    expect(rows().slice(0, 4)).toEqual([
      ["Récolte du terrain", "+7 200", "+7 200"],
      ["Champignonnière", "0", ""],
      ["Armée", "−4 800", ""],
      ["Solde", "+2 400 | +7 200 par rapport à l'actuelle", "+7 200 | −7 200 par rapport à l'actuelle"],
    ]);
  });

  it("names who takes the tribute", () => {
    const { rows } = setup({ ...state, taxRate: 0.2 });
    expect(rows()[3]).toEqual(["Pillage (20 %)", "0", "−2 880"]);
  });

  it("forecasts famine and full warehouses, against the current split", () => {
    const { field, rows, panel } = setup();
    const outlook = () => rows().at(-1);
    expect(outlook()).toEqual([
      "À venir",
      "Famine dans 5 h 00",
      "Capacité de l'entrepôt inconnue : ouvrez Construction",
    ]);
    expect(panel.querySelector(".optizzz-simulator-daily [data-row=outlook] td div")?.className).toContain(
      "optizzz-text-danger",
    );
    type(field("optizzz-food"), "100");
    expect(outlook()?.[1]).toBe("Pas de famine | actuellement : famine dans 5 h 00");
  });

  it("applies the split and the new workers' choice through the game's own form", () => {
    const { doc, field, button, change } = setup();
    const submit = doc.querySelector<HTMLInputElement>("#ChangeRessource");
    const click = vi.fn((event: Event) => {
      event.preventDefault();
    });
    submit?.addEventListener("click", click);

    type(field("optizzz-food"), "120");
    button("Nourriture")?.click();
    expect(change()).toBe("À appliquer : nourriture 0 → 120, matériaux 300 → 180, nouvelles ouvrières : nourriture.");
    button("Appliquer")?.click();

    expect(doc.querySelector<HTMLInputElement>("#RecolteNourriture")?.value).toBe("120");
    expect(doc.querySelector<HTMLInputElement>("#RecolteMateriaux")?.value).toBe("180");
    expect(doc.querySelector<HTMLInputElement>('input[name="choixOuvriere"]:checked')?.value).toBe("nourriture");
    expect(click).toHaveBeenCalledOnce();
  });

  it("colours the slider's track by share, idle workers included", () => {
    const { field } = setup(state, 400);
    const split = field("optizzz-split");
    expect(split?.style.getPropertyValue("--food")).toBe("0%");
    expect(split?.style.getPropertyValue("--assigned")).toBe("75%");
  });
});
