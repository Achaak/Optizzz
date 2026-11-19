import { describe, expect, it } from "vitest";
import type { UnlockCost } from "@optizzz/game/requirements";
import { mountUnlockCost } from "./mount";

const cost = (materials: number, food = 0, workers = 0) => ({ food, materials, workers });
/** The text with plain spaces: the numbers' are non-breaking. */
const plain = (text: string | null | undefined) =>
  text
    ?.replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Concierge on S5, 2026-11-19. */
const concierge: UnlockCost = {
  requirements: [
    { name: "Génétique", level: 5, from: 0, neededBy: null },
    { name: "Salle de combat", level: 10, from: 1, neededBy: null },
    { name: "Laboratoire", level: 18, from: 16, neededBy: "Génétique" },
  ],
  cost: cost(616_600, 93_000, 31_000),
  complete: true,
};

const mount = (unlock: UnlockCost, rowLevel: number | null = null) => {
  const description = document.createElement("td");
  const line = mountUnlockCost(description, unlock, rowLevel);
  return { description, line };
};

describe("mountUnlockCost", () => {
  it("shows each level to reach from where it is, a requirement's own in brackets after it", () => {
    const { line } = mount(concierge);
    const steps = [...(line?.querySelectorAll(".optizzz-unlock-step") ?? [])].map((step) => plain(step.textContent));
    expect(steps).toEqual(["Génétique 0 → 5 (Laboratoire 16 → 18)", "Salle de combat 1 → 10"]);
    expect(plain(line?.querySelector(".optizzz-tag")?.textContent)).toBe("Déblocage");
  });

  it("shows each resource with the game's icon, named for screen readers", () => {
    const { line } = mount(concierge);
    const amounts = [...(line?.querySelectorAll(".optizzz-unlock-amount") ?? [])];
    expect(amounts.map((amount) => plain(amount.textContent))).toEqual(["31 000", "93 000", "616 600"]);
    expect(amounts.map((amount) => amount.querySelector("img")?.getAttribute("alt"))).toEqual([
      "ouvrières",
      "nourriture",
      "matériaux",
    ]);
    expect(amounts[1]?.querySelector("img")?.getAttribute("src")).toBe("/images/icone/icone_pomme.png");
  });

  it("leaves out what costs nothing, and names the level of a row", () => {
    const { line } = mount(
      {
        requirements: [{ name: "Salle de combat", level: 3, from: 1, neededBy: null }],
        cost: cost(1_800),
        complete: true,
      },
      9,
    );
    expect(line?.querySelectorAll(".optizzz-unlock-amount")).toHaveLength(1);
    expect(line?.title).toMatch(/^Pour lancer le niveau 9\./);
  });

  it("says « au moins » when a requirement could not be costed", () => {
    const { line } = mount({ ...concierge, complete: false });
    expect(plain(line?.querySelector(".optizzz-unlock-cost")?.textContent)).toMatch(/^au moins/);
  });

  it("writes nothing when nothing could be costed", () => {
    expect(mount({ requirements: [], cost: cost(0), complete: false }).line).toBeNull();
  });

  it("adds the line once, replacing the previous one", () => {
    const { description } = mount(concierge);
    mountUnlockCost(description, concierge, null);
    expect(description.querySelectorAll(".optizzz-unlock")).toHaveLength(1);
  });
});
