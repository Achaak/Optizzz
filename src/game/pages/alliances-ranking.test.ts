import { describe, expect, it } from "vitest";
import rankingHtml from "./__fixtures__/alliances-ranking.html?raw";
import { readAlliancesRanking } from "./alliances-ranking";

const load = (html = rankingHtml) => {
  const doc = document.implementation.createHTMLDocument();
  doc.body.innerHTML = html;
  return doc;
};

describe("readAlliancesRanking", () => {
  it("reads each alliance's tag from its link, in the page's order", () => {
    expect(readAlliancesRanking(load())?.alliances.map((alliance) => alliance.tag)).toEqual(["V", "MOI", "L&R"]);
  });

  it("keeps the title row apart", () => {
    const ranking = readAlliancesRanking(load());
    expect(ranking?.headers).toHaveLength(1);
    expect(ranking?.headers[0]?.textContent).toContain("TAG");
  });

  it("skips the page links under the table", () => {
    const ranking = readAlliancesRanking(load());
    expect(ranking?.table.rows).toHaveLength(4);
  });

  it("is null without a ranking", () => {
    expect(readAlliancesRanking(load('<div id="centre"><table><tr><td>Rien</td></tr></table></div>'))).toBeNull();
  });
});
