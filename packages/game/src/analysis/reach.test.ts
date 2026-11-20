import { describe, expect, it } from "vitest";
import { allianceReach, mutualReach } from "./reach";

describe("mutualReach", () => {
  it("tells whether I can attack the player and whether they can attack me", () => {
    // 50 % included, 300 % excluded, both ways.
    // 500 is 50 % of me; I am 200 % of them.
    expect(mutualReach(1000, 500)).toEqual({ iCanAttack: true, canAttackMe: true });
    // 2 500 is 250 % of me; I am 40 % of them.
    expect(mutualReach(1000, 2500)).toEqual({ iCanAttack: true, canAttackMe: false });
    // 400 is 40 % of me; I am 250 % of them.
    expect(mutualReach(1000, 400)).toEqual({ iCanAttack: false, canAttackMe: true });
    // 3 000 is 300 % of me, excluded; I am 33 % of them.
    expect(mutualReach(1000, 3000)).toEqual({ iCanAttack: false, canAttackMe: false });
  });
});

describe("allianceReach", () => {
  const target = { field: 1000, x: 0, y: 0 };

  it("counts the members who can attack the player and those the player can attack, with the nearest attacker", () => {
    const members = [
      // Can attack it (1 000 is 50 % of them) and be attacked (they are 200 %): 5 squares away.
      { pseudo: "Far", field: 2000, x: 3, y: 4 },
      // Can attack it (1 000 is 200 %), can be attacked: 1 square away.
      { pseudo: "Near", field: 500, x: 1, y: 0 },
      // Can attack it (1 000 is 250 % of 400), out of its reach (400 is 40 % of 1 000): 2 squares away.
      { pseudo: "Small", field: 400, x: 0, y: 2 },
      // Neither: 3 000 is 300 % of 1 000, excluded; 1 000 is 33 % of 3 000.
      { pseudo: "Huge", field: 3000, x: 0, y: 1 },
    ];
    expect(allianceReach(target, members)).toEqual({
      canAttackIt: 3,
      itCanAttack: 2,
      nearestAttacker: { pseudo: "Near", distance: 1 },
    });
  });

  it("has no nearest attacker when no member can attack the player", () => {
    expect(allianceReach(target, [{ pseudo: "Huge", field: 3000, x: 0, y: 1 }])).toEqual({
      canAttackIt: 0,
      itCanAttack: 0,
      nearestAttacker: null,
    });
  });
});
