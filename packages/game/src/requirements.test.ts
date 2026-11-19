import { describe, expect, it } from "vitest";
import { costWithRequirements, unlockCost, type LevelRow } from "./requirements";

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

/** The row named `name` in `among`. */
const named = (name: string, among = rows) => {
  const found = among.find((row) => row.name === name);
  if (!found) throw new Error(name);
  return found;
};

describe("costWithRequirements", () => {
  it("costs the next level alone when nothing is missing", () => {
    expect(costWithRequirements(named("Couveuse"), rows)).toEqual({
      name: "Couveuse",
      level: 12,
      requirements: [],
      cost: cost(1_228_800),
      total: 1_228_800,
      complete: true,
    });
  });

  it("adds the missing Laboratoire levels", () => {
    expect(costWithRequirements(named("Technique de ponte", rows), rows)).toMatchObject({
      level: 10,
      requirements: [{ name: "Laboratoire", level: 10 }],
      cost: cost(61_440 + 716_800, 61_440),
      total: 61_440 * 2 + 716_800,
      complete: true,
    });
  });

  it("adds every missing level, each costing double the one before", () => {
    const behind = rows.map((row) => (row.name === "Laboratoire" ? { ...row, level: 8, cost: cost(358_400) } : row));
    expect(costWithRequirements(named("Technique de ponte", behind), behind).cost.materials).toBe(
      61_440 + 358_400 + 716_800,
    );
  });

  it("counts nothing for a requirement already reached by a level under way", () => {
    const queued = rows.map((row) => (row.name === "Laboratoire" ? { ...row, level: 10 } : row));
    expect(costWithRequirements(named("Technique de ponte", queued), queued)).toMatchObject({
      requirements: [],
      total: 61_440 * 2,
    });
  });

  it("is incomplete when a requirement is unknown or locked itself", () => {
    expect(costWithRequirements(named("Technique de ponte"), rows.slice(0, 3)).complete).toBe(false);
    const locked = rows.map((row) =>
      row.name === "Laboratoire" ? { ...row, requirements: [{ name: "Champignonnière", level: 20 }] } : row,
    );
    expect(costWithRequirements(named("Technique de ponte", locked), locked).complete).toBe(false);
  });

  /** S5 on 2026-10-19: Étable à pucerons 5 needs Communication avec les animaux 8, which needs Laboratoire 8. */
  const stable: LevelRow[] = [
    {
      name: "Etable à pucerons",
      level: 5,
      cost: cost(48_000),
      requirements: [{ name: "Communication avec les animaux", level: 8 }],
    },
    {
      name: "Communication avec les animaux",
      level: 7,
      cost: cost(64_000, 25_600, 10_240),
      requirements: [{ name: "Laboratoire", level: 8 }],
    },
    { name: "Laboratoire", level: 7, cost: cost(358_400), requirements: [] },
  ];

  it("adds the requirements of a requirement", () => {
    expect(costWithRequirements(named("Etable à pucerons", stable), stable)).toMatchObject({
      level: 6,
      requirements: [
        { name: "Communication avec les animaux", level: 8 },
        { name: "Laboratoire", level: 8 },
      ],
      cost: cost(48_000 + 64_000 + 358_400, 25_600, 10_240),
      complete: true,
    });
  });

  it("raises a requirement's own requirements one level per level it gains", () => {
    const far = stable.map((row) =>
      row.name === "Etable à pucerons"
        ? { ...row, requirements: [{ name: "Communication avec les animaux", level: 9 }] }
        : row,
    );
    // Communication 9 needs Laboratoire 9: Communication 8 needs Laboratoire 8.
    expect(costWithRequirements(named("Etable à pucerons", far), far)).toMatchObject({
      requirements: [
        { name: "Communication avec les animaux", level: 9 },
        { name: "Laboratoire", level: 9 },
      ],
      cost: cost(48_000 + 64_000 + 128_000 + 358_400 + 716_800, 25_600 + 51_200, 10_240 + 20_480),
      complete: true,
    });
  });
});

/** S5 on 2026-11-19: what the Reine's locked units wait for, and the rows they lean on. */
const s5: LevelRow[] = [
  { name: "Laboratoire", level: 16, cost: cost(45_875_200), requirements: [] },
  { name: "Salle de combat", level: 1, cost: cost(600), requirements: [] },
  { name: "Caserne", level: 0, cost: cost(800), requirements: [{ name: "Salle de combat", level: 1 }] },
  { name: "Armes", level: 7, cost: cost(25_600, 38_400, 10_240), requirements: [{ name: "Laboratoire", level: 9 }] },
  { name: "Génétique", level: 0, cost: cost(10_000, 3_000, 1_000), requirements: [{ name: "Laboratoire", level: 4 }] },
  {
    name: "Acide",
    level: 0,
    cost: cost(300_000, 100_000, 5_000),
    requirements: [
      { name: "Armes", level: 6 },
      { name: "Génétique", level: 4 },
      { name: "Laboratoire", level: 8 },
    ],
  },
];

describe("unlockCost", () => {
  it("costs nothing when every requirement is reached", () => {
    expect(unlockCost([{ name: "Salle de combat", level: 1 }], s5)).toEqual({
      requirements: [],
      cost: cost(0),
      complete: true,
    });
  });

  it("adds the missing levels of a requirement", () => {
    // Soldate Naine: Salle de combat 3, levels 2 and 3.
    expect(unlockCost([{ name: "Salle de combat", level: 3 }], s5)).toEqual({
      requirements: [{ name: "Salle de combat", level: 3, from: 1, neededBy: null }],
      cost: cost(600 + 1_200),
      complete: true,
    });
  });

  it("raises the requirements of a requirement with it", () => {
    // Naine d'Élite: Caserne 4, which needs Salle de combat 4.
    expect(unlockCost([{ name: "Caserne", level: 4 }], s5)).toMatchObject({
      requirements: [
        { name: "Caserne", level: 4, from: 0, neededBy: null },
        { name: "Salle de combat", level: 4, from: 1, neededBy: "Caserne" },
      ],
      cost: cost(800 + 1_600 + 3_200 + 6_400 + 600 + 1_200 + 2_400),
    });
  });

  it("counts a requirement asked twice once, at the highest level", () => {
    // Artilleuse d'élite: Acide 5 needs Armes 10, Génétique 8 and Laboratoire 12; Génétique 8 needs Laboratoire 11.
    const unlock = unlockCost(
      [
        { name: "Acide", level: 5 },
        { name: "Caserne", level: 1 },
      ],
      s5,
    );
    expect(unlock.requirements).toEqual([
      { name: "Acide", level: 5, from: 0, neededBy: null },
      { name: "Caserne", level: 1, from: 0, neededBy: null },
      { name: "Armes", level: 10, from: 7, neededBy: "Acide" },
      { name: "Génétique", level: 8, from: 0, neededBy: "Acide" },
    ]);
    const acid = 300_000 * 31;
    const weapons = 25_600 * 7;
    const genetics = 10_000 * 255;
    expect(unlock.cost).toEqual(
      cost(
        acid + weapons + genetics + 800,
        100_000 * 31 + 38_400 * 7 + 3_000 * 255,
        5_000 * 31 + 10_240 * 7 + 1_000 * 255,
      ),
    );
    expect(unlock.complete).toBe(true);
  });

  it("is incomplete when a requirement is on neither page", () => {
    expect(unlockCost([{ name: "Poison", level: 4 }], s5)).toEqual({
      requirements: [],
      cost: cost(0),
      complete: false,
    });
  });
});
