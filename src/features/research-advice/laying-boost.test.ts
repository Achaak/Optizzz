import { describe, expect, it } from "vitest";
import { rankLayingBoosts } from "@/game/laying-boost";
import { readLevelRows } from "@/game/pages/level-rows";
import { layingBoostText, mountLayingBoost } from "./laying-boost";

/** A row as construction.php and laboratoire.php show it (S5, 2026-10-17), the requirement repeated for phones. */
const row = (name: string, level: number, time: string, food: string, materials: string, requires = "") => `
  <tr class="ligneAmelioration">
    <td class="desciption_amelioration">
      <h2>${name}</h2><span class="niveau_amelioration">niveau ${String(level)}</span>
      ${requires && `<table><tr><td>Requis:</td><td><a class="cliquable3 verificationNonOK">${requires}</a></td></tr></table>`}
      ${requires && `<div class="que_sur_telephone"><a class="verificationNonOK">${requires}</a></div>`}
    </td>
    <td class="cout_amelioration"><table><tr>
      <td><div class="temps">${time}</div></td><td><div class="ouvriere">0</div></td>
      <td><div class="nourriture">${food}</div></td><td><div class="materiaux">${materials}</div></td>
    </tr></table></td>
  </tr>`;
const page = (rows: string) => new DOMParser().parseFromString(`<table>${rows}</table>`, "text/html");
const construction = page(
  row("Couveuse", 11, "3H 47m 11s", "0", "1 228 800") +
    row("Solarium", 9, "8H 13m 1s", "0", "1 024 000") +
    row("Laboratoire", 9, "2H 27m 54s", "0", "716 800"),
);
const laboratory = page(row("Technique de ponte", 9, "2H 52m 54s", "61 440", "61 440", "Laboratoire niveau 10"));
const rows = readLevelRows([construction, laboratory]);
const ranked = rankLayingBoosts(rows);
/** The text with plain spaces: the numbers' are non-breaking. */
const plain = (text: Record<string, string> | null | undefined) =>
  text && Object.fromEntries(Object.entries(text).map(([key, value]) => [key, value.replace(/\u00a0/g, " ")]));

describe("readLevelRows", () => {
  it("reads each missing requirement once", () => {
    expect(rows.find((candidate) => candidate.name === "Technique de ponte")?.requirements).toEqual([
      { name: "Laboratoire", level: 10 },
    ]);
    expect(rows.find((candidate) => candidate.name === "Couveuse")?.requirements).toEqual([]);
  });
});

describe("layingBoostText", () => {
  it("says the cheapest is the cheapest, Laboratoire included", () => {
    expect(plain(layingBoostText("Technique de ponte", ranked))).toEqual({
      lead: "Technique de ponte 10 d'abord :",
      strong: "le moins cher pour pondre 10 % plus vite",
      detail:
        "(839 680 ressources, Laboratoire 10 compris, contre 1 024 000 pour Solarium 10 et 1 228 800 pour Couveuse 12)",
    });
  });

  it("points the others to the cheapest", () => {
    expect(plain(layingBoostText("Couveuse", ranked))).toEqual({
      lead: "Technique de ponte 10 d'abord (Laboratoire 10 compris) :",
      strong: "même gain de ponte, 32 % moins cher",
      detail: "(839 680 ressources au lieu de 1 228 800)",
    });
  });

  it("says when two are worth the same", () => {
    const close = rankLayingBoosts(
      rows
        .filter((candidate) => candidate.name !== "Technique de ponte")
        .map((candidate) =>
          candidate.name === "Solarium"
            ? { ...candidate, cost: { ...candidate.cost, materials: 1_200_000 } }
            : candidate,
        ),
    );
    expect(plain(layingBoostText("Couveuse", close))).toMatchObject({
      lead: "Couveuse 12 et Solarium 10 se valent :",
      strong: "les moins chers pour pondre 10 % plus vite",
    });
  });

  it("says nothing with a single one", () => {
    expect(layingBoostText("Couveuse", ranked.slice(2))).toBeNull();
  });
});

describe("mountLayingBoost", () => {
  it("adds the line in the row's description", () => {
    const description = construction.querySelector(".desciption_amelioration");
    if (!description) throw new Error("fixture");
    mountLayingBoost(description, "Couveuse", ranked);
    expect(description.querySelector(".optizzz-laying-boost")?.textContent.replace(/\u00a0/g, " ")).toBe(
      "Conseil Technique de ponte 10 d'abord (Laboratoire 10 compris) : même gain de ponte, 32 % moins cher (839 680 ressources au lieu de 1 228 800)",
    );
  });
});
