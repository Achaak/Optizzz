import { describe, expect, it } from "vitest";
import { kNearestLinks, membersByDistance } from "./neighbors";

// Reference positions: A(0,0), B(3,4) at 5 from A, C(6,8) at 10 from A, D(0,1) at 1 from A.
const A = { id: 1, x: 0, y: 0 };
const B = { id: 2, x: 3, y: 4 };
const C = { id: 3, x: 6, y: 8 };
const D = { id: 4, x: 0, y: 1 };

describe("membersByDistance", () => {
  it("sorts the other members from closest to farthest, with their distance", () => {
    expect(membersByDistance(A, [A, B, C, D])).toEqual([
      { player: D, distance: 1 },
      { player: B, distance: 5 },
      { player: C, distance: 10 },
    ]);
  });
});

describe("kNearestLinks", () => {
  it("links each player to its k nearest, without duplicates", () => {
    // k=1: A→D, B→D (4.24 vs 5 for A and C), C→B, D→A.
    expect(kNearestLinks([A, B, C, D], 1)).toEqual(new Set(["1-4", "2-4", "2-3"]));
  });

  it("keeps a link even when it is not mutual", () => {
    // C is nobody's nearest, but C→B must exist.
    expect(kNearestLinks([A, B, C, D], 1).has("2-3")).toBe(true);
  });

  it("caps k at the number of other members", () => {
    expect(kNearestLinks([A, B], 5)).toEqual(new Set(["1-2"]));
  });
});
