import { describe, expect, it } from "vitest";
import alliancePageHtml from "./__fixtures__/alliance-page.html?raw";
import { findAllianceRankingTable, readAllianceRanking } from "./alliance-ranking";

const load = () => {
  const doc = document.implementation.createHTMLDocument();
  doc.body.innerHTML = alliancePageHtml;
  return doc;
};

describe("readAllianceRanking", () => {
  it("reads the alliance's name, live scores and the game's ranks", () => {
    expect(readAllianceRanking(load())).toEqual({
      name: "Victory",
      scores: { field: 2545127, building: 9793, technology: 4757, trophy: 327, members: 137 },
      ranks: { field: 1, building: 1, technology: 1, trophy: 6, members: 1 },
    });
  });

  it("leaves out a row that is missing or renamed", () => {
    const doc = load();
    [...doc.querySelectorAll("tr")].find((row) => row.textContent.includes("Combat"))?.remove();
    const ranking = readAllianceRanking(doc);
    expect(ranking?.scores.trophy).toBeUndefined();
    expect(ranking?.ranks.trophy).toBeUndefined();
  });

  it("is null for an unknown tag: the game shows an empty title and zeros", () => {
    const doc = load();
    const title = doc.querySelector("#centre > h2");
    if (title) title.textContent = "";
    expect(readAllianceRanking(doc)).toBeNull();
  });

  it("is null on a page without the ranking table", () => {
    const doc = document.implementation.createHTMLDocument();
    doc.body.innerHTML = '<div id="centre"><h2>Victory</h2></div>';
    expect(readAllianceRanking(doc)).toBeNull();
    expect(findAllianceRankingTable(doc)).toBeNull();
  });
});
