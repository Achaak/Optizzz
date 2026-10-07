import { describe, expect, it } from "vitest";
import { exportLevels, importLevels } from "./level-sharing";

const members = [
  { id: 10, pseudo: "Solenopsis" },
  { id: 20, pseudo: "Atta" },
  { id: 30, pseudo: "Ectatomma" },
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
    ).toBe("Atta: 7\nSolenopsis: 4");
  });
});

describe("importLevels", () => {
  it("matches members by nickname, ignoring case and spaces", () => {
    const result = importLevels("atta : 7\n\n  Ectatomma:2  \n", members);
    expect(result.levels).toEqual(
      new Map([
        [20, 7],
        [30, 2],
      ]),
    );
    expect(result.ignored).toEqual([]);
  });

  it("reports unreadable lines and nicknames outside the alliance", () => {
    const result = importLevels("Unknown: 3\nSolenopsis: lots\nSolenopsis: 5", members);
    expect(result.levels).toEqual(new Map([[10, 5]]));
    expect(result.ignored).toEqual(["Unknown: 3", "Solenopsis: lots"]);
  });

  it("reads back what it exported", () => {
    const levels = new Map([
      [10, 4],
      [30, 9],
    ]);
    expect(importLevels(exportLevels(levels, members), members).levels).toEqual(levels);
  });
});
