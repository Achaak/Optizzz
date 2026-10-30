import { describe, expect, it } from "vitest";
import {
  bracketRange,
  FIELD_BRACKETS,
  journalGroupFrom,
  journalGroupOf,
  journalTag,
  kindsOf,
  ordinal,
  parisDayRange,
  percentOf,
} from "./server-stats";

describe("bracketRange", () => {
  it("runs from a bracket's floor to the next one's", () => {
    expect(bracketRange(0)).toEqual({ gte: 0, lt: 1_000 });
    expect(bracketRange(2)).toEqual({ gte: 10_000, lt: 50_000 });
  });

  it("leaves the last bracket open", () => {
    expect(bracketRange(FIELD_BRACKETS.length - 1)).toEqual({ gte: 500_000 });
  });
});

describe("journalGroupOf", () => {
  it("puts wars and pacts with diplomacy, colonisations apart", () => {
    expect(journalGroupOf("war")).toBe("diplomacy");
    expect(journalGroupOf("pact-ended")).toBe("diplomacy");
    expect(journalGroupOf("colonized")).toBe("colonies");
    expect(journalGroupOf("joined")).toBe("alliances");
  });

  it("counts a kind it does not know with the players", () => {
    expect(journalGroupOf("renamed")).toBe("players");
  });
});

describe("journalTag", () => {
  it("names the kind of a Change in one word", () => {
    expect(journalTag({ kind: "war", tag: "SDF", declaredBy: "it" })).toBe("Guerre");
    expect(journalTag({ kind: "pact-ended", tag: "LBH", name: "PNA" })).toBe("Rupture");
  });
});

describe("percentOf", () => {
  it("rounds to one decimal", () => {
    expect(percentOf(9_251_531, 103_354_763)).toBe(9);
    expect(percentOf(8_090_461, 103_354_763)).toBe(7.8);
  });

  it("is 0 of nothing", () => {
    expect(percentOf(5, 0)).toBe(0);
  });
});

describe("ordinal", () => {
  it("writes the first apart", () => {
    expect(ordinal(1)).toBe("1ᵉʳ");
    expect(ordinal(2)).toBe("2ᵉ");
    expect(ordinal(1204)).toBe("1 204ᵉ");
  });
});

describe("kindsOf", () => {
  it("lists a group's kinds of Change", () => {
    expect(kindsOf("diplomacy")).toEqual(["war", "war-ended", "pact", "pact-ended"]);
    expect(kindsOf("colonies")).toEqual(["colonized", "freed"]);
  });
});

describe("journalGroupFrom", () => {
  it("reads a group, or none for anything else", () => {
    expect(journalGroupFrom("colonies")).toBe("colonies");
    expect(journalGroupFrom("all")).toBeNull();
    expect(journalGroupFrom(undefined)).toBeNull();
  });
});

describe("parisDayRange", () => {
  it("runs from a Paris midnight to the next, 25 hours on the day the clocks go back", () => {
    expect(parisDayRange("2026-10-25")).toEqual({
      gte: new Date("2026-10-24T22:00:00Z"),
      lt: new Date("2026-10-25T23:00:00Z"),
    });
  });

  it("refuses what is not a day", () => {
    expect(parisDayRange("2026-02-30")).toBeNull();
    expect(parisDayRange("26/10")).toBeNull();
  });
});
