import { describe, expect, it } from "vitest";
import { bridge, planChain, planTransfer, takeMatrix } from "./chain";
import type { Role } from "./roles";

describe("takeMatrix", () => {
  it("gives, attacker by target, 20 % of the target's field when it is from 50 % (included) to 300 % (excluded)", () => {
    const fields = [{ field: 1000 }, { field: 600 }, { field: 200 }];
    expect(takeMatrix(fields, 0)).toEqual([
      [null, 120, null],
      [200, null, null], // 200 is exactly a third of 600: out of range
      [null, null, null],
    ]);
  });

  it("keeps the plan's margin: a target just above 50 % is not counted in range", () => {
    expect(takeMatrix([{ field: 1000 }, { field: 503 }], 0.01)[0]?.[1]).toBeNull();
    expect(takeMatrix([{ field: 1000 }, { field: 505 }], 0.01)[0]?.[1]).toBe(101);
  });
});

const member = (id: number, field: number, slots = 3) => ({ id, field, slots });
const MARGIN = 0.01;

/** The transfer, failing the test on a gap. */
function transfer(...args: Parameters<typeof planTransfer>) {
  const plan = planTransfer(...args);
  if ("gap" in plan) throw new Error("unexpected gap");
  return plan;
}

describe("planTransfer", () => {
  it("takes what is asked in one attack when 20 % of the target is enough", () => {
    const plan = transfer([member(1, 600), member(2, 1000)], { from: 1, to: 2, amount: 100 }, MARGIN);
    expect(plan).toMatchObject({
      path: [1, 2],
      moved: 100,
      hits: [{ attackerId: 2, targetId: 1, take: 100, attackerAfter: 1100, targetAfter: 500 }],
    });
  });

  it("keeps the target in range for the next attack, then takes 20 % with the last one", () => {
    // 20 % (120) would leave 480 < 50 % of 1 120 (+1 %): the first attack stops at the limit (63),
    // the second takes 20 % of 537 (107), the third is out of range.
    const plan = transfer([member(1, 600), member(2, 1000)], { from: 1, to: 2, amount: 200 }, MARGIN);
    expect(plan.hits.map((hit) => hit.take)).toEqual([63, 107]);
    expect(plan.moved).toBe(170);
  });

  it("goes through a passer when the receiver cannot reach the giver, the field climbing link by link", () => {
    // 3 500 cannot attack 1 000 (under 50 %); 1 800 can attack both ends' neighbours.
    const plan = transfer([member(1, 1000), member(2, 1800), member(3, 3500)], { from: 1, to: 3, amount: 50 }, MARGIN);
    expect(plan).toMatchObject({
      path: [1, 2, 3],
      order: "up",
      moved: 50,
      hits: [
        { attackerId: 2, targetId: 1, take: 50, attackerAfter: 1850, targetAfter: 950 },
        { attackerId: 3, targetId: 2, take: 50, attackerAfter: 3550, targetAfter: 1800 },
      ],
    });
  });

  it("lands the top link first when the passer then has more room on the giver", () => {
    // Climbing, the passer (1 900) grows on the giver and stops at 220; lending first to the top (1 650),
    // it takes the 250 in two attacks: 110 to stay in range, then 140.
    const plan = transfer([member(1, 1000), member(2, 1900), member(3, 3700)], { from: 1, to: 3, amount: 250 }, MARGIN);
    expect(plan.order).toBe("down");
    expect(plan.moved).toBe(250);
    expect(plan.hits.map(({ attackerId, targetId, take }) => [attackerId, targetId, take])).toEqual([
      [3, 2, 250],
      [2, 1, 110],
      [2, 1, 140],
    ]);
  });

  it("moves only what the weakest link can, so the passers end where they started", () => {
    const plan = transfer(
      [member(1, 1000), member(2, 1900, 1), member(3, 3700)],
      { from: 1, to: 3, amount: 400 },
      MARGIN,
    );
    // One attack for the passer: 20 % of the giver at most.
    expect(plan.moved).toBe(200);
    expect(plan.hits.filter((hit) => hit.attackerId === 2).reduce((sum, hit) => sum + hit.take, 0)).toBe(200);
    expect(plan.hits.filter((hit) => hit.attackerId === 3).reduce((sum, hit) => sum + hit.take, 0)).toBe(200);
  });

  it("names the gap when nobody bridges it: the highest member reached and the receiver", () => {
    const members = [member(1, 1000), member(2, 1800), member(3, 9000)];
    expect(planTransfer(members, { from: 1, to: 3, amount: 100 }, MARGIN)).toEqual({
      gap: { below: 2, above: 3, reason: "range" },
    });
  });
});

describe("bridge", () => {
  it("gives the fields of a passer that the receiver can attack and that can attack the giver", () => {
    // At least half of 11 022 (+1 %), at most twice 3 100 (-1 %).
    expect(bridge(3100, 11022, MARGIN)).toEqual({ passers: 1, min: 5567, max: 6138 });
  });

  it("counts the passers needed when one is not enough", () => {
    expect(bridge(1000, 5000, MARGIN)).toEqual({ passers: 2 });
  });
});

describe("planChain", () => {
  const hunter: Role = { kind: "hunter" };
  const passer: Role = { kind: "passer", rank: 1 };
  const granary: Role = { kind: "granary" };
  const out: Role = { kind: "out" };

  it("sends each hunter's field above what it keeps up to the smallest granary, through the passers", () => {
    const plan = planChain(
      {
        members: [member(1, 1000), member(2, 1800), member(3, 3500), member(4, 3000)],
        roles: new Map<number, Role>([
          [1, hunter],
          [2, passer],
          [3, granary],
          [4, granary],
        ]),
        keep: new Map([[1, 800]]),
      },
      MARGIN,
    );
    expect(plan.gaps).toEqual([]);
    expect(plan.transfers).toMatchObject([
      {
        path: [1, 2, 4],
        moved: 200,
        hits: [
          { attackerId: 2, targetId: 1, take: 200 },
          { attackerId: 4, targetId: 2, take: 200 },
        ],
      },
    ]);
  });

  it("starts with the biggest surplus, and fills the granary that is then the smallest", () => {
    const plan = planChain(
      {
        members: [member(1, 1000), member(2, 1100), member(3, 1800), member(4, 3150), member(5, 3000)],
        roles: new Map<number, Role>([
          [1, hunter],
          [2, hunter],
          [3, passer],
          [4, granary],
          [5, granary],
        ]),
        keep: new Map([
          [1, 800],
          [2, 1000],
        ]),
      },
      MARGIN,
    );
    // 200 from the first hunter make the second granary 3 200: the 100 of the other go to the first one.
    expect(plan.transfers.map(({ path, moved }) => ({ path, moved }))).toEqual([
      { path: [1, 3, 5], moved: 200 },
      { path: [2, 3, 4], moved: 100 },
    ]);
  });

  it("goes to another granary when the smallest one has no attack left", () => {
    // The smallest granary has one attack at a time: the first hunter's field uses it.
    const plan = planChain(
      {
        members: [member(1, 1000), member(2, 1000), member(3, 1800), member(4, 3000, 1), member(5, 3300)],
        roles: new Map<number, Role>([
          [1, hunter],
          [2, hunter],
          [3, passer],
          [4, granary],
          [5, granary],
        ]),
        keep: new Map([
          [1, 900],
          [2, 900],
        ]),
      },
      MARGIN,
    );
    expect(plan.transfers.map(({ path, moved }) => ({ path, moved }))).toEqual([
      { path: [1, 3, 4], moved: 100 },
      { path: [2, 3, 5], moved: 100 },
    ]);
  });

  it("says when the chain is in range but out of attacks", () => {
    const plan = planChain(
      {
        members: [member(1, 1000), member(2, 1000), member(3, 1800, 1), member(4, 3000)],
        roles: new Map<number, Role>([
          [1, hunter],
          [2, hunter],
          [3, passer],
          [4, granary],
        ]),
        keep: new Map([
          [1, 900],
          [2, 950],
        ]),
      },
      MARGIN,
    );
    expect(plan.transfers.map(({ path, moved }) => ({ path, moved }))).toEqual([{ path: [1, 3, 4], moved: 100 }]);
    expect(plan.gaps).toEqual([{ from: 2, below: 2, above: 4, reason: "attacks" }]);
  });

  it("never goes through a member out of the chain, and names the gap instead", () => {
    const plan = planChain(
      {
        members: [member(1, 1000), member(2, 1900), member(3, 3500)],
        roles: new Map<number, Role>([
          [1, hunter],
          [2, out],
          [3, granary],
        ]),
        keep: new Map([[1, 900]]),
      },
      MARGIN,
    );
    expect(plan.transfers).toEqual([]);
    expect(plan.gaps).toEqual([{ from: 1, below: 1, above: 3, reason: "range" }]);
  });

  it("leaves alone a hunter with nothing to keep entered", () => {
    const plan = planChain(
      {
        members: [member(1, 1000), member(2, 1800)],
        roles: new Map<number, Role>([
          [1, hunter],
          [2, granary],
        ]),
        keep: new Map(),
      },
      MARGIN,
    );
    expect(plan).toEqual({ transfers: [], gaps: [] });
  });
});
