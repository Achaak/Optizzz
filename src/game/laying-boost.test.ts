import { describe, expect, it } from "vitest";
import { layingBoost, LAYING_FACTOR, rankLayingBoosts, type BoostRow } from "./laying-boost";

const cost = (materials: number, food = 0, workers = 0) => ({ food, materials, workers });
/** S5 on 2026-10-17: Couveuse 11, Solarium 9, Technique de ponte 9 (needs Laboratoire 10), Laboratoire 9. */
const rows: BoostRow[] = [
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

/** The row named `name` in `among`. */
const named = (name: string, among = rows) => {
  const found = among.find((row) => row.name === name);
  if (!found) throw new Error(name);
  return found;
};

describe("LAYING_FACTOR", () => {
  it("is the speed Reine.php shows for 29 levels in all (S5, 2026-10-17)", () => {
    expect(LAYING_FACTOR ** 29).toBeCloseTo(0.047101286972462, 12);
  });
});

describe("layingBoost", () => {
  it("costs the next level alone when nothing is missing", () => {
    expect(layingBoost(named("Couveuse"), rows)).toEqual({
      name: "Couveuse",
      level: 12,
      requirements: [],
      cost: cost(1_228_800),
      total: 1_228_800,
      complete: true,
    });
  });

  it("adds the missing Laboratoire levels", () => {
    expect(layingBoost(named("Technique de ponte", rows), rows)).toMatchObject({
      level: 10,
      requirements: [{ name: "Laboratoire", level: 10 }],
      cost: cost(61_440 + 716_800, 61_440),
      total: 61_440 * 2 + 716_800,
      complete: true,
    });
  });

  it("adds every missing level, each costing double the one before", () => {
    const behind = rows.map((row) => (row.name === "Laboratoire" ? { ...row, level: 8, cost: cost(358_400) } : row));
    expect(layingBoost(named("Technique de ponte", behind), behind).cost.materials).toBe(61_440 + 358_400 + 716_800);
  });

  it("counts nothing for a requirement already reached by a level under way", () => {
    const queued = rows.map((row) => (row.name === "Laboratoire" ? { ...row, level: 10 } : row));
    expect(layingBoost(named("Technique de ponte", queued), queued)).toMatchObject({
      requirements: [],
      total: 61_440 * 2,
    });
  });

  it("is incomplete when a requirement is unknown or locked itself", () => {
    expect(layingBoost(named("Technique de ponte"), rows.slice(0, 3)).complete).toBe(false);
    const locked = rows.map((row) =>
      row.name === "Laboratoire" ? { ...row, requirements: [{ name: "Champignonnière", level: 20 }] } : row,
    );
    expect(layingBoost(named("Technique de ponte", locked), locked).complete).toBe(false);
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
