import { describe, expect, it, vi } from "vitest";
import { armyFromKeys } from "@optizzz/game/army/units";
import { DEFAULT_ADVICE_PREFS, mountResearchAdvice, type AdviceData, type AdviceRow } from "./mount";

const now = new Date("2026-10-16T12:00:00Z");
// The player of the example: 2 560 workers re-laid in 2 h 00, Bouclier 5 → 6.
const data: AdviceData = {
  kind: "ready",
  army: armyFromKeys({ JSN: 15_000, SN: 1282 }),
  armyReadAt: new Date(now.getTime() - 3_600_000),
  armySource: { kind: "live", attacks: 2, hunts: 1, unknown: 0 },
  speed: 7235 / (2560 * 60),
  layable: ["JSN", "SN", "A"],
  layingReadAt: now,
};

const setup = (row: AdviceRow, advice: AdviceData = data, prefs = DEFAULT_ADVICE_PREFS) => {
  const doc = new DOMParser().parseFromString(
    `<table><tr class="ligneAmelioration"><td></td><td class="desciption_amelioration"></td><td></td><td></td></tr><tr><td>next</td></tr></table>`,
    "text/html",
  );
  const description = doc.querySelector(".desciption_amelioration");
  if (!description) throw new Error("fixture");
  const save = vi.fn();
  const details = mountResearchAdvice(description, row, advice, prefs, save, now);
  return { doc, description, details, save };
};
/** Numbers are written with non-breaking spaces: compared with plain ones. */
const text = (node: Node | null | undefined) => node?.textContent?.replace(/\u00a0/g, " ");
const shield: AdviceRow = { research: "shield", level: 5, workers: 2560 };
const weapons: AdviceRow = { research: "weapons", level: 5, workers: 2560 };

describe("mountResearchAdvice", () => {
  it("adds a block in the row's description, like the other advice, folded to its verdict", () => {
    const { description, details } = setup(shield);
    expect(details.parentElement).toBe(description);
    expect(details.open).toBe(false);
    expect(text(details.querySelector("summary"))).toContain("Recherche préférable · +116 % de vie que la ponte");
    // Not only a colour: the verdict is written.
    expect(details.dataset.verdict).toBe("research");
  });

  it("compares the research with the best unit, with the time to lay the workers again", () => {
    const { details } = setup(shield);
    const shown = text(details);
    expect(shown).toContain("Recherche niveau 6");
    expect(shown).toContain("+13 282 points de vie");
    expect(shown).toContain("ou 512 Jeunes Soldates Naines");
    expect(shown).toContain("+6 144 points de vie");
    expect(shown).toContain("les repondre prend 2 h 01");
    expect(shown).toContain(
      "La recherche l'emporte dès 61 440 points de vie de base dans l'armée ; la vôtre en a 132 820.",
    );
    expect([...details.querySelectorAll(".optizzz-advice-units tr")].map((tr) => text(tr.firstElementChild))).toEqual([
      "Unité",
      "Jeune Soldate Naine",
      "Soldate Naine",
      "Artilleuse",
    ]);
  });

  it("says when laying brings more, by how much", () => {
    const { details } = setup(shield, { ...data, army: armyFromKeys({ JSN: 3000 }) });
    expect(details.dataset.verdict).toBe("laying");
    expect(text(details.querySelector("summary"))).toContain(
      "Ponte préférable · Jeunes Soldates Naines : +156 % de vie",
    );
    expect(text(details)).toContain("la vôtre n'en a que 24 000");
  });

  it("writes a large gap as a multiple", () => {
    const { details } = setup(shield, { ...data, army: armyFromKeys({ JSN: 100 }) });
    expect(text(details.querySelector("summary"))).toContain("Jeunes Soldates Naines : 77 × plus de vie");
  });

  it("compares Armes on the attack or the defense, as the player chose, and remembers it", () => {
    const { details, save } = setup(weapons);
    expect(text(details)).toContain("dégâts en attaque");
    const defense = [...details.querySelectorAll("button")].find((button) => button.textContent === "la défense");
    defense?.click();
    expect(save).toHaveBeenCalledWith({ weaponsStat: "defense" });
    expect(text(details)).toContain("dégâts en défense");
    expect(text(details.querySelector('button[aria-pressed="true"]'))).toBe("la défense");
  });

  it("remembers whether it is unfolded", () => {
    const { details, save } = setup(shield, data, { open: { shield: true }, weaponsStat: "attack" });
    expect(details.open).toBe(true);
    details.open = false;
    details.dispatchEvent(new Event("toggle"));
    expect(save).toHaveBeenCalledWith({ open: { shield: false } });
  });

  it("says where the army comes from", () => {
    expect(text(setup(shield).details)).toContain(
      "armée lue aujourd'hui 13 h 00, garnison, 2 attaques et 1 chasse en cours,",
    );
    const stored = text(setup(shield, { ...data, armySource: { kind: "stored", previous: false } }).details);
    expect(stored).toContain("armée en garnison aujourd'hui 13 h 00, troupes en chasse ou en attaque non comptées");
    const blind = text(
      setup(shield, { ...data, armySource: { kind: "live", attacks: 0, hunts: 0, unknown: 2 } }).details,
    );
    expect(blind).toContain("garnison (2 sorties non comptées : le jeu n'en montre les troupes qu'avec Compte+)");
  });

  it("says what is missing instead of a guess", () => {
    const { details } = setup(shield, { kind: "missing", message: "Armée inconnue : passez par la page Armée." });
    expect(text(details.querySelector("summary"))).toContain("Armée inconnue");
    expect(details.dataset.verdict).toBeUndefined();
  });
});
