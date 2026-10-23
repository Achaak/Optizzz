import { describe, expect, it } from "vitest";
import { openLevels, parseMyLevels, pickLevels, resumeLevels, typedLevels } from "./my-levels";

describe("« Mes niveaux »", () => {
  it("are filled by what is typed in a tool opened without a link", () => {
    const memory = openLevels({ weapons: 10 }, { fromLink: false });
    expect(memory.linked).toBe(false);
    expect(typedLevels(memory, { shield: 8 }).mine).toEqual({ weapons: 10, shield: 8 });
    expect(typedLevels(memory, { weapons: 11 }).mine).toEqual({ weapons: 11 });
  });

  it("forget a level whose field is emptied", () => {
    const memory = openLevels({ weapons: 10, shield: 8 }, { fromLink: false });
    expect(typedLevels(memory, { weapons: null }).mine).toEqual({ shield: 8 });
  });

  it("are never overwritten by a link, nor by what is typed over its levels", () => {
    const memory = openLevels({ weapons: 10 }, { fromLink: true });
    expect(memory.linked).toBe(true);
    expect(typedLevels(memory, { weapons: 30 })).toEqual(memory);
  });

  it("come back with « Reprendre mes niveaux », and from then on follow what is typed", () => {
    const { memory, levels } = resumeLevels(openLevels({ weapons: 10, dome: 4 }, { fromLink: true }));
    expect(levels).toEqual({ weapons: 10, dome: 4 });
    expect(memory.linked).toBe(false);
    expect(typedLevels(memory, { weapons: 12 }).mine).toEqual({ weapons: 12, dome: 4 });
  });

  it("pre-fill only the levels a tool asks for", () => {
    expect(pickLevels({ weapons: 10, dome: 4, laying: 3 }, ["weapons", "shield", "dome"])).toEqual({
      weapons: 10,
      shield: null,
      dome: 4,
    });
  });

  it("are read back from the browser, leaving out what is not a level", () => {
    expect(parseMyLevels(JSON.stringify({ weapons: 10, attackSpeed: 3 }))).toEqual({ weapons: 10, attackSpeed: 3 });
    expect(parseMyLevels(JSON.stringify({ weapons: -1, shield: 2.5, dome: 4, mushroom: 3, x: "a" }))).toEqual({
      dome: 4,
    });
    expect(parseMyLevels("not json")).toEqual({});
    expect(parseMyLevels(null)).toEqual({});
    expect(parseMyLevels("[1]")).toEqual({});
  });
});
