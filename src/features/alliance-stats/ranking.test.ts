import { describe, expect, it } from "vitest";
import rankingHtml from "@/game/pages/__fixtures__/alliances-ranking.html?raw";
import { readAlliancesRanking } from "@/game/pages/alliances-ranking";
import { addCurveColumn, assignColors, CURVE_COLUMN_CLASS, followRanking } from "./ranking";

const page = () => {
  const doc = document.implementation.createHTMLDocument();
  doc.body.innerHTML = rankingHtml;
  return doc;
};

const ranking = (doc = page()) => {
  const read = readAlliancesRanking(doc);
  if (!read) throw new Error("no ranking");
  return read;
};

describe("addCurveColumn", () => {
  it("adds a last cell to every row, titled in the header", () => {
    const read = ranking();
    const cells = addCurveColumn(read);
    expect(cells.map((cell) => cell.tag)).toEqual(["V", "-AP-", "MOI"]);
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

describe("followRanking", () => {
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

  it("adds the column again when the game draws the table anew", async () => {
    const doc = page();
    const read = ranking(doc);
    const drawn: string[][] = [];
    const stop = followRanking(read.zone, (cells) => drawn.push(cells.map((cell) => cell.tag)));
    // As the game does on a change of criterion, page or league.
    read.zone.innerHTML = read.zone.innerHTML.replace("alliance=V", "alliance=W").replace(">V<", ">W<");
    await settle();
    stop();
    expect(drawn).toEqual([["W", "-AP-", "MOI"]]);
    expect(doc.querySelectorAll(`#zone_classement td.${CURVE_COLUMN_CLASS}`)).toHaveLength(3);
  });

  it("stops following", async () => {
    const read = ranking();
    const drawn: unknown[] = [];
    followRanking(read.zone, (cells) => drawn.push(cells))();
    read.zone.innerHTML = rankingHtml;
    await settle();
    expect(drawn).toEqual([]);
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
