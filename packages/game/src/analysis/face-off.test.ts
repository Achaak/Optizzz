import { describe, expect, it } from "vitest";
import { faceOff } from "./face-off";

const member = (pseudo: string, field: number, x: number, unavailable = false) => ({
  pseudo,
  field,
  x,
  y: 0,
  unavailable,
});

describe("faceOff", () => {
  // Ours: Big (2 000) at 0, Small (400) at 10, Away on holiday.
  // Theirs: Mid (1 000) at 3, Tiny (100) at 20.
  // Big → Mid (50 %): yes; Big → Tiny (5 %): no. Small → Mid (250 %): yes; Small → Tiny (25 %): no.
  // Mid → Big (200 %): yes; Mid → Small (40 %): no. Tiny → Big, Small: 2 000 %, 400 %, no.
  const ours = [member("Big", 2000, 0), member("Small", 400, 10), member("Away", 1000, 3, true)];
  const theirs = [member("Mid", 1000, 3), member("Tiny", 100, 20)];

  it("says for each member how many on the other side it can take, and the nearest of them", () => {
    const result = faceOff(ours, theirs);
    expect(result.ours.members.map((m) => [m.pseudo, m.canTake, m.nearest])).toEqual([
      ["Big", 1, { pseudo: "Mid", distance: 3 }],
      ["Small", 1, { pseudo: "Mid", distance: 7 }],
      ["Away", 0, null],
    ]);
    expect(result.theirs.members.map((m) => [m.pseudo, m.canTake, m.nearest])).toEqual([
      ["Mid", 1, { pseudo: "Big", distance: 3 }],
      ["Tiny", 0, null],
    ]);
  });

  it("adds up each side's field in reach of the other, and counts who is out of any reach, holidays aside", () => {
    const result = faceOff(ours, theirs);
    // Only Big can be taken by Mid; Small is in no one's reach but can take Mid.
    expect(result.ours).toMatchObject({ exposedField: 2000, exposedCount: 1, outOfReach: 0, available: 2 });
    // Mid can be taken by Big and Small; Tiny is out of any reach both ways.
    expect(result.theirs).toMatchObject({ exposedField: 1000, exposedCount: 1, outOfReach: 1, available: 2 });
  });

  it("gives the median distance between the two sides' members", () => {
    // Pairs: Big–Mid 3, Big–Tiny 20, Small–Mid 7, Small–Tiny 10: median of 3, 7, 10, 20 is 8.5.
    expect(faceOff(ours, theirs).medianDistance).toBe(8.5);
    expect(faceOff([], theirs).medianDistance).toBeNull();
  });
});
