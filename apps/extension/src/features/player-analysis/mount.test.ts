import { describe, expect, it } from "vitest";
import profileHtml from "@optizzz/game/pages/__fixtures__/profile.html?raw";
import { findProfileStateRow } from "@optizzz/game/pages/scores";
import { ANALYSIS_ROW_ATTRIBUTE, mountAnalysisBox, mountAnalysisRows } from "./mount";

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

describe("mountAnalysisBox", () => {
  const grid = () => Array.from({ length: 7 }, () => Array<number>(24).fill(0));
  const flood = (hour: number, amount: number, sureness: "sure" | "unknown", direction: "lost" | "taken" = "lost") => ({
    since: `2026-11-20T${String(hour - 1).padStart(2, "0")}:05:00.000Z`,
    at: `2026-11-20T${String(hour).padStart(2, "0")}:05:00.000Z`,
    direction,
    amount,
    others: sureness === "sure" ? [{ id: 2, pseudo: "Lunaire", alliance: "AP" }] : [],
    alliance: sureness === "sure" ? "AP" : null,
    sureness,
  });
  const now = new Date("2026-11-20T18:00:00Z");
  const box = (doc: Document) => doc.querySelector(".optizzz-analysis");
  const lines = (doc: Document) => [...(box(doc)?.querySelectorAll("li") ?? [])].map((li) => li.textContent);

  it("says the quiet hours, the 3 latest floods of the week, the rank and where to see more", () => {
    const doc = profile();
    mountAnalysisBox(doc, {
      analysis: {
        days: 28,
        quietHours: { from: 2, to: 9 },
        grid: { rises: grid(), falls: grid() },
        floods: [
          flood(5, 128_400, "sure"),
          flood(4, 1000, "unknown"),
          flood(3, 94_210, "sure", "taken"),
          flood(2, 5, "unknown"),
        ],
      },
      rank: { faster: 171, peers: 214 },
      siteHref: "https://optizzz.fr/s5/players/42",
      now,
    });
    expect(box(doc)?.querySelector(".optizzz-panel-title")?.textContent).toBe("Analyse");
    expect(box(doc)?.textContent).toContain("Plage calme habituelle : 2 h – 9 h");
    expect(lines(doc)).toEqual([
      "aujourd'hui entre 5 h et 6 h · ▼ −128 400 · probablement par Lunaire (AP)",
      "aujourd'hui entre 4 h et 5 h · ▼ −1 000 · coupable inconnu",
      "aujourd'hui entre 3 h et 4 h · ▲ +94 210 · probablement pris à Lunaire (AP)",
    ]);
    expect(box(doc)?.textContent).toContain("Tout voir sur optizzz.fr (4 sur 30 jours)");
    expect(box(doc)?.textContent).toContain("Progresse plus vite que 80 % des 214 joueurs de sa taille sur 7 j.");
    expect(box(doc)?.querySelector<HTMLAnchorElement>("a")?.href).toBe("https://optizzz.fr/s5/players/42");
  });

  it("says when the site does not answer, and keeps the rank", () => {
    const doc = profile();
    mountAnalysisBox(doc, {
      analysis: null,
      rank: { faster: 1, peers: 10 },
      siteHref: "https://optizzz.fr/s5/players/42",
      now,
    });
    expect(box(doc)?.textContent).toContain("Analyse horaire indisponible (optizzz.fr ne répond pas).");
    expect(box(doc)?.textContent).toContain("Progresse plus vite que 10 %");
  });

  it("goes under the « Progression » box, and is replaced rather than added twice", () => {
    const doc = profile();
    const progression = doc.createElement("optizzz-profile-history");
    doc.querySelector(".boite_membre")?.after(progression);
    const input = { analysis: null, rank: null, siteHref: "https://optizzz.fr/s5/players/42", now };
    mountAnalysisBox(doc, input);
    mountAnalysisBox(doc, input);
    expect(doc.querySelectorAll(".optizzz-analysis")).toHaveLength(1);
    expect(progression.nextElementSibling?.classList.contains("optizzz-analysis")).toBe(true);
  });
});
