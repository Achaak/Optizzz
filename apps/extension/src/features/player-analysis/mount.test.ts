import { describe, expect, it } from "vitest";
import profileHtml from "@optizzz/game/pages/__fixtures__/profile.html?raw";
import { findProfileStateRow } from "@optizzz/game/pages/scores";
import { ANALYSIS_ROW_ATTRIBUTE, mountAnalysisRows } from "./mount";

const profile = () => {
  const doc = document.implementation.createHTMLDocument();
  doc.body.innerHTML = profileHtml;
  return doc;
};

const rowsOf = (doc: Document) =>
  [...doc.querySelectorAll<HTMLTableRowElement>(`tr[${ANALYSIS_ROW_ATTRIBUTE}]`)].map((row) => [
    row.cells[0]?.textContent,
    row.cells[1]?.textContent,
  ]);

describe("mountAnalysisRows", () => {
  it("says under « Etat » whether each can attack the other, and how the player stands against my alliance", () => {
    const doc = profile();
    mountAnalysisRows(doc, {
      reach: { iCanAttack: true, canAttackMe: false },
      alliance: { canAttackIt: 7, itCanAttack: 1, nearestAttacker: { pseudo: "Myrmi", distance: 3.2 } },
      inactivity: null,
    });
    expect(rowsOf(doc)).toEqual([
      ["Portée :", "à votre portée · vous êtes hors de sa portée"],
      ["Votre alliance :", "7 membres peuvent l'attaquer, 1 est à sa portée · le plus proche : Myrmi, 3 cases"],
    ]);
    expect(findProfileStateRow(doc)?.nextElementSibling?.hasAttribute(ANALYSIS_ROW_ATTRIBUTE)).toBe(true);
  });

  it("says when no member can attack the player", () => {
    const doc = profile();
    mountAnalysisRows(doc, {
      reach: { iCanAttack: false, canAttackMe: true },
      alliance: { canAttackIt: 0, itCanAttack: 2, nearestAttacker: null },
      inactivity: null,
    });
    expect(rowsOf(doc)).toEqual([
      ["Portée :", "hors de votre portée · vous êtes à sa portée"],
      ["Votre alliance :", "aucun membre ne peut l'attaquer, 2 sont à sa portée"],
    ]);
  });

  it("says a probable inactivity, and when only losses moved", () => {
    const doc = profile();
    mountAnalysisRows(doc, { reach: null, alliance: null, inactivity: { days: 5, onlyLosses: true } });
    expect(rowsOf(doc)).toEqual([["Activité :", "Inactif probable depuis 5 j (rien n'a bougé sauf des pertes)"]]);
  });

  it("comes after the production rows, and updates them instead of adding them twice", () => {
    const doc = profile();
    const production = doc.createElement("tr");
    production.setAttribute("data-optizzz-production", "");
    findProfileStateRow(doc)?.after(production);
    mountAnalysisRows(doc, { reach: { iCanAttack: true, canAttackMe: true }, alliance: null, inactivity: null });
    mountAnalysisRows(doc, { reach: { iCanAttack: false, canAttackMe: false }, alliance: null, inactivity: null });
    expect(production.nextElementSibling?.hasAttribute(ANALYSIS_ROW_ATTRIBUTE)).toBe(true);
    expect(rowsOf(doc)).toEqual([["Portée :", "hors de votre portée · vous êtes hors de sa portée"]]);
  });
});
