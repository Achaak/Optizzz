import { describe, expect, it } from "vitest";
import { bracketRange, FIELD_BRACKETS, journalGroupOf, journalTag, ordinal, percentOf } from "./server-stats";

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
