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
    expect(readAlliancesRanking(load())?.alliances.map((alliance) => alliance.tag)).toEqual(["V", "-AP-", "MOI"]);
  });

  it("keeps the title row apart", () => {
    const ranking = readAlliancesRanking(load());
    expect(ranking?.headers).toHaveLength(1);
    expect(ranking?.headers[0]?.textContent).toContain("Alliance");
  });

  it("takes the game's table, not the box around it", () => {
    const ranking = readAlliancesRanking(load());
    expect(ranking?.table.classList.contains("tab_triable")).toBe(true);
    expect(ranking?.table.rows).toHaveLength(4);
  });

  it("gives the zone the game fills again over AJAX", () => {
    expect(readAlliancesRanking(load())?.zone.id).toBe("zone_classement");
  });

  it("reads the average per player too", () => {
    const doc = load();
    const type = doc.querySelector<HTMLSelectElement>("#type_classement");
    if (type) type.value = "alliance_moyenne";
    expect(readAlliancesRanking(doc)?.alliances).toHaveLength(3);
  });

  it("is null on the players' ranking, though its rows link to their alliance", () => {
    const players = `<div id="centre"><div id="zone_classement"><table class="tab_triable">
      <tr><th>Rang</th><th>Pseudo</th></tr>
      <tr><td>1</td><td><a href="Membre.php?Pseudo=A">A</a> <a href="classementAlliance.php?alliance=V">V</a></td></tr>
    </table></div></div>`;
    expect(readAlliancesRanking(load(players))).toBeNull();
  });

  it("is null without a ranking", () => {
    expect(readAlliancesRanking(load('<div id="centre"><table><tr><td>Rien</td></tr></table></div>'))).toBeNull();
  });
});
