import { describe, expect, it } from "vitest";
import { compareHref, deltaText, idsOf, mergeSeries, periodStart } from "./compare";

describe("idsOf", () => {
  it("reads players' ids, without repeats or anything else", () => {
    expect(idsOf("players", "12,7,abc,12,,3")).toEqual(["12", "7", "3"]);
  });

  it("reads alliances' tags as written, once whatever their case", () => {
    expect(idsOf("alliances", "4O4, -AP-,4o4")).toEqual(["4O4", "-AP-"]);
  });

  it("keeps the first five", () => {
    expect(idsOf("players", "1,2,3,4,5,6")).toEqual(["1", "2", "3", "4", "5"]);
  });

  it("reads nothing from a missing or repeated parameter", () => {
    expect(idsOf("players", undefined)).toEqual([]);
    expect(idsOf("players", ["1", "2"])).toEqual([]);
  });
});

describe("compareHref", () => {
  it("leaves the defaults out", () => {
    expect(compareHref("s5", { kind: "players", ids: ["12", "7"], metric: "field", period: "all" })).toBe(
      "/s5/compare?ids=12%2C7",
    );
  });

  it("keeps what differs from them", () => {
    expect(compareHref("s5", { kind: "alliances", ids: ["4O4"], metric: "rank", period: "30" })).toBe(
      "/s5/compare?type=alliances&ids=4O4&courbe=rank&periode=30",
    );
  });
});

describe("periodStart", () => {
  const last = new Date("2026-10-26T00:00:00Z");

  it("goes back the period's days from the last one, itself included", () => {
    expect(periodStart("7", last)).toEqual(new Date("2026-10-20T00:00:00Z"));
  });

  it("is open for the whole history", () => {
    expect(periodStart("all", last)).toBeNull();
  });
});

describe("mergeSeries", () => {
  const day = (text: string) => new Date(`2026-10-${text}T00:00:00Z`);

  it("puts each day once, oldest first, with each series' value that day", () => {
    const rows = mergeSeries([
      {
        points: [
          { day: day("21"), value: 5 },
          { day: day("20"), value: 4 },
        ],
      },
      { points: [{ day: day("21"), value: 9 }] },
    ]);
    expect(rows).toEqual([
      { day: day("20"), values: [4, null] },
      { day: day("21"), values: [5, 9] },
    ]);
  });
});

describe("deltaText", () => {
  it("signs a score's change", () => {
    expect(deltaText(118_040, 700_235, false)).toBe("+582 195");
    expect(deltaText(700, 650, false)).toBe("−50");
  });

  it("counts a rank's places gained upward", () => {
    expect(deltaText(9, 2, true)).toBe("▲ 7");
    expect(deltaText(2, 5, true)).toBe("▼ 3");
  });

  it("says when nothing moved", () => {
    expect(deltaText(3, 3, true)).toBe("=");
  });
});
