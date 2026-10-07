import { describe, expect, it } from "vitest";
import constructionFullHtml from "./__fixtures__/construction-full.html?raw";
import constructionIdleHtml from "./__fixtures__/construction-idle.html?raw";
import laboratoryOneHtml from "./__fixtures__/laboratory-one.html?raw";
import { mountWorkQueue } from "./mount";

const parse = (html: string) => new DOMParser().parseFromString(html, "text/html");
const now = new Date(2026, 9, 7, 12, 50, 0);

const rowsOf = (table: HTMLElement) =>
  [...table.querySelectorAll("tbody tr")].map((row) =>
    [...row.querySelectorAll("td")].map((cell) => cell.textContent.trim()),
  );

describe("mountWorkQueue", () => {
  it("replaces the game's lines with a table of the queue", () => {
    const doc = parse(constructionFullHtml);
    const { table } = mountWorkQueue(doc, now);

    expect(rowsOf(table)).toEqual([
      ["Champignonnière 8 → 9", "en cours", "0 %", "1 h 26", "aujourd'hui 14 h 15", "Annuler"],
      ["Entrepôt de Nourriture 5 → 6", "en attente", "0 %", "1 h 57", "aujourd'hui 14 h 46", "Annuler"],
    ]);
    expect(table.querySelector("a")?.getAttribute("href")).toBe("construction.php?annuler=1791375374&t=abcd");
  });

  it("hides the game's lines without removing them", () => {
    const doc = parse(constructionFullHtml);
    mountWorkQueue(doc, now);

    const gameLines = [...doc.querySelectorAll("strong")].filter((line) => line.querySelector('span[id^="batiment_"]'));
    expect(gameLines).toHaveLength(2);
    for (const line of gameLines) expect(line.hidden).toBe(true);
    for (const end of doc.querySelectorAll("small")) expect(end.hidden).toBe(true);
  });

  it("tells when the next slot frees up if the queue is full", () => {
    const { table } = mountWorkQueue(parse(constructionFullHtml), now);
    expect(table.querySelector("tfoot")?.textContent.trim()).toBe(
      "File pleine : prochaine place libre aujourd'hui 14 h 15",
    );
  });

  it("shows a running research's progress, with no footer while a slot is free", () => {
    const { table } = mountWorkQueue(parse(laboratoryOneHtml), now);
    expect(rowsOf(table)).toEqual([
      ["Architecture 0 → 1", "en cours", "6 %", "4 min", "aujourd'hui 12 h 53", "Annuler"],
    ]);
    expect(table.querySelector("tfoot")?.textContent.trim()).toBe("");
  });

  it("says when nothing is in progress", () => {
    const { table } = mountWorkQueue(parse(constructionIdleHtml), now);
    expect(rowsOf(table)).toEqual([]);
    expect(table.querySelector("tfoot")?.textContent.trim()).toBe("Aucune construction en cours");
    expect(table.querySelector("thead")?.hidden).toBe(true);
  });
});
