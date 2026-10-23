import { describe, expect, it } from "vitest";
import { armyFromKeys } from "@optizzz/game/army/units";
import { emptyForm, simulate, toBattle } from "@optizzz/game/army/battle-form";
import { combatLinkFormat } from "@optizzz/game/site-links/combat";
import { decodeOpponent, encodeOpponent, leaveSide, prefill, siteState, withOpponent } from "./form";
import type { Garrison } from "@/data/garrison";

const garrison: Garrison = {
  armies: {
    field: armyFromKeys({ JSN: 1200 }),
    nest: armyFromKeys({ Tk: 40 }),
    lodge: armyFromKeys({ JSN: 19, TuE: 5 }),
  },
  dome: 3,
  lodge: 1,
  field: 4496,
};
const levels = { weapons: 4, shield: 5, aphids: 2 };

describe("prefill", () => {
  it("puts the whole army on the attacking side", () => {
    const form = prefill(emptyForm(), "attack", garrison, levels);
    expect(form.attacker).toEqual({
      army: { JSN: 1219, Tk: 40, TuE: 5 },
      weapons: 4,
      shield: 5,
      field: 4496,
      aphids: 2,
    });
    expect(form.defender).toEqual(emptyForm().defender);
  });

  it("puts each place's army, the dome and the lodge on the defending side", () => {
    const form = prefill(emptyForm(), "defend", garrison, levels);
    expect(form.defender).toMatchObject({
      armies: { field: { JSN: 1200 }, nest: { Tk: 40 }, lodge: { JSN: 19, TuE: 5 } },
      weapons: 4,
      shield: 5,
      dome: 3,
      lodge: 1,
      field: 4496,
    });
    expect(form.attacker).toEqual(emptyForm().attacker);
  });

  it("keeps the form as is without a remembered garrison, levels aside", () => {
    expect(prefill(emptyForm(), "attack", null, {}).attacker).toEqual(emptyForm().attacker);
  });
});

describe("leaveSide", () => {
  it("empties the player's old side only if they did not change it", () => {
    const filled = prefill(emptyForm(), "attack", garrison, levels);
    expect(leaveSide(filled, "attack", filled).attacker).toEqual(emptyForm().attacker);
  });

  it("keeps an army pasted on the player's old side: the opponent's", () => {
    const filled = prefill(emptyForm(), "attack", garrison, levels);
    const pasted = { ...filled, attacker: { ...filled.attacker, army: { JSN: 5000 } } };
    expect(leaveSide(pasted, "attack", filled).attacker.army).toEqual({ JSN: 5000 });
  });

  it("never touches the other side", () => {
    const filled = prefill(emptyForm(), "attack", garrison, levels);
    const withDefense = {
      ...filled,
      defender: { ...filled.defender, armies: { ...filled.defender.armies, field: { SN: 30 } } },
    };
    expect(leaveSide(withDefense, "attack", filled).defender.armies.field).toEqual({ SN: 30 });
  });
});

describe("toBattle", () => {
  it("turns the form into the engine's input", () => {
    const form = prefill(emptyForm(), "defend", garrison, levels);
    const { attacker, defender } = toBattle(form);
    expect(attacker.army).toEqual(armyFromKeys({}));
    expect(defender.armies.lodge).toEqual(armyFromKeys({ JSN: 19, TuE: 5 }));
    expect(defender).toMatchObject({ weapons: 4, shield: 5, dome: 3, lodge: 1 });
  });
});

describe("opponent", () => {
  const opponent = { place: "nest", army: { TuE: 28892 }, weapons: 31 } as const;

  it("puts the army seen in a report on the defending side, at the place attacked, with its Weapons", () => {
    const form = withOpponent(prefill(emptyForm(), "attack", garrison, levels), opponent);
    expect(form.defender.armies).toEqual({ field: {}, nest: { TuE: 28892 }, lodge: {} });
    expect(form.defender.weapons).toBe(31);
    expect(form.target).toBe("nest");
    expect(form.attacker.army).toEqual({ JSN: 1219, Tk: 40, TuE: 5 });
  });

  it("leaves the defender's Weapons alone when the report could not tell them", () => {
    const form = withOpponent(
      { ...emptyForm(), defender: { ...emptyForm().defender, weapons: 7 } },
      {
        ...opponent,
        weapons: null,
      },
    );
    expect(form.defender.weapons).toBe(7);
  });

  it("goes through the page's address and back", () => {
    expect(decodeOpponent(encodeOpponent(opponent))).toEqual(opponent);
  });

  it("is null for an address it cannot read", () => {
    expect(decodeOpponent(null)).toBeNull();
    expect(decodeOpponent("{")).toBeNull();
    expect(decodeOpponent('{"place":"moon","army":{},"weapons":1}')).toBeNull();
    expect(decodeOpponent('{"place":"field","army":{"JSN":-3},"weapons":1}')).toBeNull();
  });
});

describe("siteState", () => {
  it("gives optizzz.fr the same engine input, hence the same fight, with « Mes niveaux » on the player's side", () => {
    const form = withOpponent(prefill(emptyForm(), "attack", garrison, levels), {
      place: "nest",
      army: { TuE: 300, JS: 12 },
      weapons: 9,
    });
    const read = combatLinkFormat.decode(siteState({ ...form, defender: { ...form.defender, food: 5000 } }, "attack"));
    expect(read?.mine).toBe("attack");
    expect(read && toBattle(read.form)).toEqual(toBattle(form));
    expect(read && simulate(read.form)).toEqual(simulate({ ...form, defender: { ...form.defender, food: 5000 } }));
  });
});
