import { describe, expect, it } from "vitest";
import rankingHtml from "@/game/pages/__fixtures__/alliances-ranking.html?raw";
import { readAlliancesRanking } from "@/game/pages/alliances-ranking";
import { addCurveColumn, assignColors, CURVE_COLUMN_CLASS } from "./ranking";

const ranking = () => {
  const doc = document.implementation.createHTMLDocument();
  doc.body.innerHTML = rankingHtml;
  const read = readAlliancesRanking(doc);
  if (!read) throw new Error("no ranking");
  return read;
};

describe("addCurveColumn", () => {
  it("adds a last cell to every row, titled in the header", () => {
    const read = ranking();
    const cells = addCurveColumn(read);
    expect(cells.map((cell) => cell.tag)).toEqual(["V", "MOI", "L&R"]);
    for (const row of read.table.rows) expect(row.lastElementChild?.classList.contains(CURVE_COLUMN_CLASS)).toBe(true);
    expect(read.headers[0]?.lastElementChild?.textContent).toBe("Graphique");
  });

  it("adds it once", () => {
    const read = ranking();
    addCurveColumn(read);
    expect(addCurveColumn(read)).toEqual([]);
    expect(read.table.querySelectorAll(`th.${CURVE_COLUMN_CLASS}`)).toHaveLength(1);
  });
});

describe("assignColors", () => {
  const palette = ["red", "blue", "gold"];

  it("gives the palette in order", () => {
    expect([...assignColors(["A", "B"], new Map(), palette)]).toEqual([
      ["A", "red"],
      ["B", "blue"],
    ]);
  });

  it("keeps an alliance's colour when another one goes", () => {
    const before = assignColors(["A", "B", "C"], new Map(), palette);
    expect(assignColors(["A", "C"], before, palette).get("C")).toBe("gold");
  });

  it("gives a newcomer the first colour left", () => {
    const before = new Map([
      ["A", "red"],
      ["C", "gold"],
    ]);
    expect(assignColors(["A", "C", "D"], before, palette).get("D")).toBe("blue");
  });

  it("ignores the case of the tags", () => {
    expect(assignColors(["abc"], new Map([["ABC", "gold"]]), palette).get("abc")).toBe("gold");
  });
});
