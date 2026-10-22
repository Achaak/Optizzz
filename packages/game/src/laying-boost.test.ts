import { describe, expect, it } from "vitest";
import { LAYING_FACTOR, rankLayingBoosts } from "./laying-boost";
import type { LevelRow } from "./requirements";

const cost = (materials: number, food = 0, workers = 0) => ({ food, materials, workers });
/** S5 on 2026-10-17: Couveuse 11, Solarium 9, Technique de ponte 9 (needs Laboratoire 10), Laboratoire 9. */
const rows: LevelRow[] = [
  { name: "Couveuse", level: 11, cost: cost(1_228_800), requirements: [] },
  { name: "Solarium", level: 9, cost: cost(1_024_000), requirements: [] },
  {
    name: "Technique de ponte",
    level: 9,
    cost: cost(61_440, 61_440),
    requirements: [{ name: "Laboratoire", level: 10 }],
  },
  { name: "Laboratoire", level: 9, cost: cost(716_800), requirements: [] },
];

describe("LAYING_FACTOR", () => {
  it("is the speed Reine.php shows for 29 levels in all (S5, 2026-10-17)", () => {
    expect(LAYING_FACTOR ** 29).toBeCloseTo(0.047101286972462, 12);
  });
});

describe("rankLayingBoosts", () => {
  it("puts the cheapest first", () => {
    expect(rankLayingBoosts(rows).map((boost) => boost.name)).toEqual(["Technique de ponte", "Solarium", "Couveuse"]);
  });

  it("only ranks the three boosts", () => {
    expect(rankLayingBoosts(rows)).toHaveLength(3);
  });
});
