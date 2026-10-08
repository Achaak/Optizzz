import { describe, expect, it, vi } from "vitest";
import { armyFromKeys, emptyArmy } from "@/game/army/units";
import formHtml from "./__fixtures__/attack-form.html?raw";
import { mountFloodPlanner, type FloodContext } from "./mount";

const now = new Date(2026, 9, 8, 10, 0, 0);

const setup = (options: Partial<FloodContext> = {}) => {
  const doc = new DOMParser().parseFromString(formHtml, "text/html");
  const context: FloodContext = {
    me: { field: 1000, weapons: 0, shield: 0 },
    target: { id: 101, pseudo: "Cible_1", field: 2000 },
    // Field 1 000 JSN + 50 S, nest 200 JSN, lodge 5 000 JSN (the fixture).
    available: {
      field: armyFromKeys({ JSN: 1000, S: 50 }),
      nest: armyFromKeys({ JSN: 200 }),
      lodge: armyFromKeys({ JSN: 5000 }),
    },
    attackSpeed: 2,
    travelSeconds: 1800,
    launches: [],
    defense: null,
    countLodge: false,
    margin: 0,
    onCountLodgeChange: () => undefined,
    onDefenseChange: () => undefined,
    onSend: () => undefined,
    ...options,
  };
  mountFloodPlanner(doc, context, () => now);
  const rows = () =>
    [...doc.querySelectorAll(".optizzz-flood tbody tr")].map((row) =>
      [...row.querySelectorAll("td")].map((cell) => cell.textContent.trim()),
    );
  const text = () => doc.querySelector(".optizzz-flood")?.textContent ?? "";
  const unit = (id: string) => (doc.getElementById(id) as HTMLInputElement).value;
  return { doc, rows, text, unit };
};

describe("mountFloodPlanner", () => {
  it("plans the flood under the game's form with my free slots and army, lodge left out", () => {
    const { doc, rows, text } = setup();
    expect(doc.getElementById("formulaireChoixArmee")?.nextElementSibling?.className).toBe("optizzz-flood");
    // 3 slots (Attack Speed 2 + 1), 1 250 ants: 400, 320, 256, cheapest first.
    expect(rows()).toEqual([
      ["1", "400 JSN", "400", "1 600", "1 400", "Remplir"],
      ["2", "320 JSN", "320", "1 280", "1 720", "Remplir"],
      ["3", "256 JSN", "256", "1 024", "1 976", "Remplir"],
    ]);
    expect(text()).toContain("Total : 976 cm² en 3 attaques");
    expect(text()).toContain("arrivée ≈ 10 h 30");
  });

  it("fills the game's form with an attack, the player sends it", () => {
    const { doc, unit } = setup();
    const buttons = [...doc.querySelectorAll<HTMLButtonElement>(".optizzz-flood tbody button")];
    buttons[1]?.click();
    expect([unit("unite1"), unit("unite5")]).toEqual(["320", "0"]);
  });

  it("counts the attacks already on their way", () => {
    const { rows } = setup({
      launches: [{ targetId: 101, target: "Cible_1", ants: 400, take: 400, arrivesAt: new Date(2026, 9, 8, 10, 20) }],
    });
    // 2 slots left; it will have 1 600, me 1 400.
    expect(rows().map((cells) => cells[2])).toEqual(["320", "256"]);
  });

  it("can count the lodge, and remembers it", () => {
    const onCountLodgeChange = vi.fn();
    const { doc, text } = setup({
      available: { field: emptyArmy(), nest: emptyArmy(), lodge: armyFromKeys({ JSN: 5000 }) },
      onCountLodgeChange,
    });
    expect(text()).toContain("Votre armée est en Loge");
    const box = doc.querySelector<HTMLInputElement>(".optizzz-flood-lodge");
    box?.click();
    expect(onCountLodgeChange).toHaveBeenCalledWith(true);
    expect(doc.querySelectorAll(".optizzz-flood tbody tr")).toHaveLength(3);
  });

  it("opens with a wave that crushes a pasted defense", () => {
    const onDefenseChange = vi.fn();
    const { doc, rows } = setup({ onDefenseChange });
    const area = doc.querySelector<HTMLTextAreaElement>(".optizzz-flood-defense textarea");
    if (area) area.value = "Troupes en défense : 100 Jeunes Soldates Naines.";
    doc.querySelector<HTMLButtonElement>(".optizzz-flood-defense-use")?.click();
    expect(onDefenseChange).toHaveBeenCalledWith(armyFromKeys({ JSN: 100 }));
    // Strongest first: 50 S + 551 JSN deal 750 + 1 653 > 3 × 800 hp; 649 JSN left: 320, then 256.
    expect(rows().map((cells) => cells[1])).toEqual(["551 JSN, 50 S", "320 JSN", "256 JSN"]);
  });

  it("says when my army cannot beat the defense", () => {
    const { text, rows } = setup({ defense: { army: armyFromKeys({ JSN: 1000 }), readAt: now } });
    expect(rows()).toEqual([]);
    expect(text()).toContain("Votre armée ne suffit pas");
  });

  it("says when the target is out of range", () => {
    const { text } = setup({ target: { id: 101, pseudo: "Cible_1", field: 400 } });
    expect(text()).toContain("hors de portée");
  });

  it("remembers what the player sends, to plan the next attack", () => {
    const onSend = vi.fn();
    const { doc } = setup({ onSend });
    doc.querySelector<HTMLButtonElement>(".optizzz-flood tbody button")?.click();
    const form = doc.getElementById("formulaireChoixArmee") as HTMLFormElement;
    form.addEventListener("submit", (event) => {
      event.preventDefault();
    });
    form.dispatchEvent(new Event("submit", { cancelable: true }));
    expect(onSend).toHaveBeenCalledWith({
      targetId: 101,
      target: "Cible_1",
      ants: 400,
      take: 400,
      arrivesAt: new Date(2026, 9, 8, 10, 30),
    });
  });
});
