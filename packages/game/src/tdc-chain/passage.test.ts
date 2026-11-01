import { describe, expect, it } from "vitest";
import type { Role } from "./roles";
import { planPassage, projectChain, type PassageMember, type PlanInput } from "./passage";

const NOW = new Date("2026-11-01T12:00:00Z").getTime();
const MIN = 60_000;

const member = (id: number, pseudo: string, field: number, more: Partial<PassageMember> = {}): PassageMember => ({
  id,
  pseudo,
  field,
  fieldAt: NOW - 10 * MIN,
  ...more,
});

describe("the chain's fields over time, with the floods on their way", () => {
  it("moves a flood's expected take from its target to its attacker when it lands", () => {
    const projection = projectChain({
      members: [member(1, "Lunaire", 1_000_000), member(2, "Mandibule", 680_000)],
      floods: [{ from: "lunaire", target: "Mandibule", at: NOW + 30 * MIN, take: 136_000 }],
      hunts: [],
    });
    expect(projection.floods).toEqual([
      {
        from: "Lunaire",
        target: "Mandibule",
        at: NOW + 30 * MIN,
        expected: 136_000,
        actual: 136_000,
        status: "holds",
        targetBefore: 680_000,
        targetAfter: 544_000,
        before: null,
      },
    ]);
    expect(projection.fieldAt(2, NOW)).toBe(680_000);
    expect(projection.fieldAt(2, NOW + 31 * MIN)).toBe(544_000);
    expect(projection.fieldAt(1, NOW + 31 * MIN)).toBe(1_136_000);
  });

  it("takes 20 % at arrival for a flood launched without the Plan", () => {
    const projection = projectChain({
      members: [member(1, "Lunaire", 1_000_000), member(2, "Mandibule", 680_000)],
      floods: [{ from: "Lunaire", target: "Mandibule", at: NOW + 30 * MIN, take: null }],
      hunts: [],
    });
    expect(projection.floods[0]).toMatchObject({ expected: 136_000, actual: 136_000, status: "holds" });
  });

  it("tells a flood that lands out of range, which takes nothing", () => {
    const projection = projectChain({
      members: [member(1, "Lunaire", 1_000_000), member(2, "Brindille", 540_000)],
      floods: [
        { from: "Lunaire", target: "Brindille", at: NOW + 20 * MIN, take: 108_000 },
        { from: "Lunaire", target: "Brindille", at: NOW + 45 * MIN, take: 86_400 },
      ],
      hunts: [],
    });
    expect(projection.floods[1]).toMatchObject({
      status: "fails",
      actual: 0,
      targetBefore: 432_000,
      targetAfter: 432_000,
    });
    expect(projection.fieldAt(2, NOW + 60 * MIN)).toBe(432_000);
  });

  it("tells a flood whose take shrinks because another lands before it on the same target", () => {
    const projection = projectChain({
      members: [member(1, "Lunaire", 1_000_000), member(2, "Mandibule", 680_000), member(3, "Okapi", 1_150_000)],
      floods: [
        { from: "Lunaire", target: "Mandibule", at: NOW + 36 * MIN, take: 136_000 },
        { from: "Okapi", target: "Mandibule", at: NOW + 31 * MIN, take: 136_000 },
      ],
      hunts: [],
    });
    expect(projection.floods.map((f) => [f.from, f.status, f.actual, f.before])).toEqual([
      ["Okapi", "holds", 136_000, null],
      ["Lunaire", "reduced", 108_800, "Okapi"],
    ]);
  });

  it("does not count again what landed before a member's field was read, and adds the hunts on their return", () => {
    const projection = projectChain({
      members: [member(1, "Lunaire", 1_000_000), member(2, "Mandibule", 680_000)],
      floods: [{ from: "Lunaire", target: "Mandibule", at: NOW - 20 * MIN, take: 136_000 }],
      hunts: [{ memberId: 2, at: NOW + 60 * MIN, gain: 50_000 }],
    });
    expect(projection.fieldAt(2, NOW)).toBe(680_000);
    expect(projection.fieldAt(2, NOW + 61 * MIN)).toBe(730_000);
  });
});

const HOUR = 60 * MIN;
const granary: Role = { kind: "granary" };
const hunter: Role = { kind: "hunter" };
const passer = (rank: number): Role => ({ kind: "passer", rank });

const plan = (more: Partial<PlanInput>): PlanInput => ({
  members: [],
  roles: new Map(),
  keep: new Map(),
  floods: [],
  hunts: [],
  slots: new Map(),
  now: NOW,
  horizon: 6 * HOUR,
  travel: () => ({ seconds: 30 * 60, approx: false }),
  margin: 0.01,
  ...more,
});

describe("the floods to launch", () => {
  const G = member(1, "Noctis", 1_800_000);
  const H = member(2, "Zeph", 1_100_000);

  it("plans a hunter's surplus up to the granary, landing after the time to leave and travel", () => {
    const result = planPassage(
      plan({
        members: [G, H],
        roles: new Map<number, Role>([
          [1, granary],
          [2, hunter],
        ]),
        keep: new Map([[2, 800_000]]),
        slots: new Map([[1, 3]]),
      }),
    );
    // Hand-worked: the largest take that keeps Zeph in range for the next one, floor((2 × 1 100 000 − 1,01 ×
    // 1 800 000) / 3,01) = 126 910, then the 173 090 left of the 300 000 surplus.
    expect(result.launches).toEqual([
      {
        n: 1,
        attackerId: 1,
        targetId: 2,
        take: 126_910,
        arrival: NOW + 35 * MIN,
        departFrom: NOW + 5 * MIN,
        // The next flood between the same two lands a minute later: this one cannot leave later.
        departTo: NOW + 5 * MIN,
        approx: false,
        attackerBefore: 1_800_000,
        attackerAfter: 1_926_910,
        targetBefore: 1_100_000,
        targetAfter: 973_090,
      },
      {
        n: 2,
        attackerId: 1,
        targetId: 2,
        take: 173_090,
        arrival: NOW + 36 * MIN,
        departFrom: NOW + 6 * MIN,
        // Nothing after it: it may land up to the horizon.
        departTo: NOW + 6 * HOUR - 30 * MIN,
        approx: false,
        attackerBefore: 1_926_910,
        attackerAfter: 2_100_000,
        targetBefore: 973_090,
        targetAfter: 800_000,
      },
    ]);
  });

  it("lands a minute after the last flood on its way to its target, from the field it leaves", () => {
    const result = planPassage(
      plan({
        members: [G, H],
        roles: new Map<number, Role>([
          [1, granary],
          [2, hunter],
        ]),
        keep: new Map([[2, 800_000]]),
        slots: new Map([[1, 3]]),
        floods: [{ from: "Noctis", target: "Zeph", at: NOW + 2 * HOUR, take: 100_000 }],
      }),
    );
    // Noctis 1 900 000, Zeph 1 000 000 once it landed; a slot is still taken until then.
    expect(result.launches[0]).toMatchObject({
      arrival: NOW + 2 * HOUR + MIN,
      attackerBefore: 1_900_000,
      targetBefore: 1_000_000,
    });
    expect(result.launches.reduce((sum, l) => sum + l.take, 0)).toBe(200_000);
  });

  it("waits too for a flood on its way sent by its target or to its attacker", () => {
    const result = planPassage(
      plan({
        members: [G, H, member(3, "Gargantua", 1_500_000)],
        roles: new Map<number, Role>([
          [1, granary],
          [2, hunter],
        ]),
        keep: new Map([[2, 800_000]]),
        slots: new Map([[1, 3]]),
        floods: [{ from: "Zeph", target: "Gargantua", at: NOW + 3 * HOUR, take: 50_000 }],
      }),
    );
    expect(result.launches[0]?.arrival).toBe(NOW + 3 * HOUR + MIN);
  });

  it("counts the attacks already on their way against the attacker's slots", () => {
    const result = planPassage(
      plan({
        members: [G, H, member(3, "Gargantua", 3_000_000)],
        roles: new Map<number, Role>([
          [1, granary],
          [2, hunter],
        ]),
        keep: new Map([[2, 800_000]]),
        slots: new Map([[1, 1]]),
        floods: [{ from: "Noctis", target: "Gargantua", at: NOW + HOUR, take: 1 }],
      }),
    );
    expect(result.launches).toEqual([]);
    expect(result.gaps).toEqual([{ from: 2, below: 2, above: 1, reason: "attacks" }]);
  });

  it("leaves out a transfer that would land after the horizon", () => {
    const result = planPassage(
      plan({
        members: [G, H],
        roles: new Map<number, Role>([
          [1, granary],
          [2, hunter],
        ]),
        keep: new Map([[2, 800_000]]),
        slots: new Map([[1, 3]]),
        horizon: 2 * HOUR,
        travel: () => ({ seconds: 3 * 3600, approx: true }),
      }),
    );
    expect(result.launches).toEqual([]);
    expect(result.dropped).toBe(1);
  });

  it("passes the field through a passer, each flood leaving no later than the next one lands", () => {
    const result = planPassage(
      plan({
        members: [member(1, "Noctis", 4_000_000), member(2, "XaTaK", 2_200_000), member(3, "Zeph", 1_200_000)],
        roles: new Map<number, Role>([
          [1, granary],
          [2, passer(1)],
          [3, hunter],
        ]),
        keep: new Map([[3, 1_000_000]]),
        slots: new Map([
          [1, 3],
          [2, 3],
        ]),
      }),
    );
    expect(result.launches.map((l) => [l.attackerId, l.targetId, l.take])).toEqual([
      [2, 3, 200_000],
      [1, 2, 200_000],
    ]);
    const [first, second] = result.launches;
    expect(second?.arrival).toBe((first?.arrival ?? 0) + MIN);
    expect(first?.departTo).toBe(first?.departFrom);
    expect(result.fieldAt(1, NOW + 6 * HOUR)).toBe(4_200_000);
    expect(result.fieldAt(2, NOW + 6 * HOUR)).toBe(2_200_000);
    expect(result.fieldAt(3, NOW + 6 * HOUR)).toBe(1_000_000);
  });

  it("caps each flood at the attacker's army when it is known", () => {
    const result = planPassage(
      plan({
        members: [G, H],
        roles: new Map<number, Role>([
          [1, granary],
          [2, hunter],
        ]),
        keep: new Map([[2, 800_000]]),
        slots: new Map([[1, 3]]),
        ants: new Map([[1, 100_000]]),
      }),
    );
    // Hand-worked: 100 000 (the army), then the largest take that keeps Zeph in range, floor((2 × 1 000 000 − 1,01 ×
    // 1 900 000) / 3,01) = 26 910, then a last 100 000 with the third and last slot.
    expect(result.launches.map((l) => l.take)).toEqual([100_000, 26_910, 100_000]);
  });
});
