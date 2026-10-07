import { describe, expect, it } from "vitest";
import headerHtml from "./__fixtures__/header.html?raw";
import type { ColonyState } from "./forecast";
import { renderOutlook } from "./mount-outlook";

const MINUTE = 60_000;
const now = new Date(2026, 9, 7, 12, 0);
const at = (minutes: number) => new Date(now.getTime() + minutes * MINUTE);
const parse = (html: string) => new DOMParser().parseFromString(html, "text/html");

const colony = (overrides: Partial<ColonyState> = {}): ColonyState => ({
  food: 0,
  materials: 0,
  workers: 1000,
  foodWorkers: 0,
  materialWorkers: 0,
  mushroomPerDay: 0,
  armyPerDay: 0,
  taxRate: 0,
  nextHarvestAt: at(10),
  hunts: [],
  newWorkersGoTo: "none",
  capacities: null,
  ...overrides,
});

const badge = (doc: Document, gauge: "nourriture" | "materiaux") =>
  doc.querySelector(`.jauge_${gauge}`)?.closest("td")?.querySelector(".optizzz-outlook") ?? null;

describe("renderOutlook", () => {
  it("warns under the food gauge when food runs out, in red under 6 hours", () => {
    const doc = parse(headerHtml);
    // 2 400 a day = 100 an hour.
    renderOutlook(doc, colony({ food: 100, armyPerDay: 2400 }), now);
    const famine = badge(doc, "nourriture");
    expect(famine?.textContent).toBe("Famine dans 1 h 00");
    expect(famine?.classList.contains("optizzz-outlook-danger")).toBe(true);
  });

  it("is orange under a day and neutral beyond", () => {
    const doc = parse(headerHtml);
    renderOutlook(doc, colony({ food: 1200, armyPerDay: 2400 }), now);
    expect(badge(doc, "nourriture")?.classList.contains("optizzz-outlook-warning")).toBe(true);

    renderOutlook(doc, colony({ food: 4800, armyPerDay: 2400 }), now);
    expect(badge(doc, "nourriture")?.textContent).toBe("Famine dans 2 j 0 h");
    expect(badge(doc, "nourriture")?.className).toBe("optizzz-outlook");
  });

  it("tells when each warehouse is full", () => {
    const doc = parse(headerHtml);
    renderOutlook(
      doc,
      colony({ food: 900, mushroomPerDay: 2400, materialWorkers: 100, capacities: { food: 1000, materials: 250 } }),
      now,
    );
    expect(badge(doc, "nourriture")?.textContent).toBe("Entrepôt plein dans 1 h 00");
    expect(badge(doc, "materiaux")?.textContent).toBe("Entrepôt plein dans 1 h 10");
  });

  it("counts down from when the stock was read", () => {
    const doc = parse(headerHtml);
    renderOutlook(doc, colony({ food: 100, armyPerDay: 2400 }), now, at(20));
    expect(badge(doc, "nourriture")?.textContent).toBe("Famine dans 40 min");
  });

  it("shows the daily food balance, with its details, when nothing is coming", () => {
    const doc = parse(headerHtml);
    renderOutlook(doc, colony({ mushroomPerDay: 2400, armyPerDay: 1000 }), now);
    const balance = badge(doc, "nourriture");
    expect(balance?.textContent).toBe("Solde : +1 400 / jour");
    expect(balance?.className).toBe("optizzz-outlook");
    expect(balance?.getAttribute("title")).toContain("Équilibre : 0 ouvrières sur la nourriture");
    expect(badge(doc, "materiaux")).toBeNull();
  });

  it("details the daily food balance and the balance point in the tooltip", () => {
    const doc = parse(headerHtml);
    const state = colony({
      food: 100,
      foodWorkers: 10,
      materialWorkers: 290,
      mushroomPerDay: 5022,
      armyPerDay: 6000,
      hunts: [{ returnsAt: at(39), fieldGain: 122 }],
    });
    renderOutlook(doc, state, now);
    expect(badge(doc, "nourriture")?.getAttribute("title")).toBe(
      [
        "Nourriture par jour : −498",
        "Récolte +480, champignonnière +5 022, armée −6 000",
        "Équilibre : 21 ouvrières sur la nourriture",
        "Chasse de retour aujourd'hui 12 h 39 : +122 cm²",
      ].join("\n"),
    );
  });
});
