import { describe, expect, it } from "vitest";
import { exportLevels, importLevels } from "./level-sharing";

const members = [
  { id: 10, pseudo: "Peanut" },
  { id: 20, pseudo: "Delta" },
  { id: 30, pseudo: "Vik.Bat" },
];

describe("exportLevels", () => {
  it("writes one « Pseudo: level » line per known member, sorted by nickname", () => {
    expect(
      exportLevels(
        new Map([
          [10, 4],
          [20, 7],
        ]),
        members,
      ),
    ).toBe("Delta: 7\nPeanut: 4");
  });
});

describe("importLevels", () => {
  it("matches members by nickname, ignoring case and spaces", () => {
    const result = importLevels("delta : 7\n\n  Vik.Bat:2  \n", members);
    expect(result.levels).toEqual(
      new Map([
        [20, 7],
        [30, 2],
      ]),
    );
    expect(result.ignored).toEqual([]);
  });

  it("reports unreadable lines and nicknames outside the alliance", () => {
    const result = importLevels("Unknown: 3\nPeanut: lots\nPeanut: 5", members);
    expect(result.levels).toEqual(new Map([[10, 5]]));
    expect(result.ignored).toEqual(["Unknown: 3", "Peanut: lots"]);
  });

  it("reads back what it exported", () => {
    const levels = new Map([
      [10, 4],
      [30, 9],
    ]);
    expect(importLevels(exportLevels(levels, members), members).levels).toEqual(levels);
  });
});
