import { describe, expect, it } from "vitest";
import { afterOnWay } from "@/data/on-way";

const launch = (targetId: number, take: number) => ({
  targetId,
  target: `Cible_${String(targetId)}`,
  ants: take,
  take,
  arrivesAt: new Date(2026, 9, 8, 12, 0),
});

describe("afterOnWay", () => {
  it("adds every take on its way to my field, removes this target's, and counts every attack as a slot", () => {
    const onWay = { launches: [launch(1, 200), launch(2, 100)], unknown: 1 };
    expect(afterOnWay(1000, { id: 1, field: 2000 }, onWay, 3)).toEqual({
      myField: 1300,
      targetField: 1800,
      slots: 1,
      onTarget: 1,
    });
  });
});
