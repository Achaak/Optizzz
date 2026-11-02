import { describe, expect, it } from "vitest";
import { defenseLevelsText, guessDefenseLevels, levelsWithShield } from "./report-levels";
import { levelBonus } from "./units";

/** Damage that kills exactly `kills` JSN (8 hp) of hp factor `factor`, plus half a JSN: no rounding at the edge. */
const damageFor = (kills: number, factor: number) => Math.round((kills + 0.5) * 8 * factor);

describe("guessDefenseLevels", () => {
  it("finds the Bouclier on the hunting field from the kills", () => {
    const factor = levelBonus(7);
    const guesses = guessDefenseLevels("field", { JSN: 10_000 }, [{ dealt: damageFor(3000, factor), killed: 3000 }]);
    expect(guesses).toEqual([{ shield: 7, level: 0 }]);
    expect(defenseLevelsText("field", guesses)).toBe("Bouclier 7");
  });

  it("gives every Bouclier and Dôme pair at the nest, two Dôme levels for one Bouclier level", () => {
    // 1 + 0,1 × 14 + 0,1 + 0,05 × 6 = 2,8
    const guesses = guessDefenseLevels("nest", { JSN: 40_000 }, [{ dealt: damageFor(16_000, 2.8), killed: 16_000 }]);
    expect(guesses.length).toBe(18);
    expect(guesses[0]).toEqual({ shield: 17, level: 0 });
    expect(guesses.at(-1)).toEqual({ shield: 0, level: 34 });
    expect(levelsWithShield(guesses, 10)).toEqual([14]);
    expect(defenseLevelsText("nest", guesses)).toBe("Bouclier 17 et Dôme 0 à Bouclier 0 et Dôme 34 (18 couples)");
  });

  it("follows the exchanges: the damage of each one adds up", () => {
    const factor = levelBonus(5) + 0.3 + 0.15 * 4;
    const first = damageFor(1000, factor);
    const second = damageFor(2500, factor) - first;
    const guesses = guessDefenseLevels("lodge", { JSN: 5000 }, [
      { dealt: first, killed: 1000 },
      { dealt: second, killed: 1500 },
    ]);
    expect(levelsWithShield(guesses, 5)).toEqual([4]);
  });

  it("says nothing when every defender fell: any Bouclier high enough would do", () => {
    expect(guessDefenseLevels("field", { JSN: 10 }, [{ dealt: 19_221 + 9611, killed: 10 }])).toEqual([]);
  });

  it("says nothing when no level gives the kills back", () => {
    expect(guessDefenseLevels("field", { JSN: 1000 }, [{ dealt: 80, killed: 500 }])).toEqual([]);
  });
});
