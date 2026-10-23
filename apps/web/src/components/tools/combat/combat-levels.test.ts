import { emptyForm } from "@optizzz/game/army/battle-form";
import { describe, expect, it } from "vitest";
import { chooseMySide, sideLevels, withLevels } from "./combat-levels";

const mine = { weapons: 12, shield: 11, dome: 14, lodge: 8, aphids: 9, huntSpeed: 3 };

describe("« Mes niveaux » in the combat simulator", () => {
  it("fill the attacker's Armes, Bouclier and Étable à pucerons", () => {
    const form = withLevels(emptyForm(), "attack", mine);
    expect(form.attacker).toMatchObject({ weapons: 12, shield: 11, aphids: 9 });
    expect(form.defender).toEqual(emptyForm().defender);
  });

  it("fill the defender's Armes, Bouclier, Dôme and Loge", () => {
    const form = withLevels(emptyForm(), "defend", mine);
    expect(form.defender).toMatchObject({ weapons: 12, shield: 11, dome: 14, lodge: 8 });
    expect(form.attacker).toEqual(emptyForm().attacker);
  });

  it("leave a field alone when its level is not known", () => {
    const typed = { ...emptyForm(), attacker: { ...emptyForm().attacker, shield: 4 } };
    expect(withLevels(typed, "attack", { weapons: 2 }).attacker).toMatchObject({ weapons: 2, shield: 4 });
  });

  it("are read back from the side's fields", () => {
    expect(sideLevels(withLevels(emptyForm(), "defend", mine), "defend")).toEqual({
      weapons: 12,
      shield: 11,
      dome: 14,
      lodge: 8,
    });
  });

  it("move to the side the visitor chooses, the other side kept", () => {
    const start = { form: withLevels(emptyForm(), "attack", mine), mine: "attack" as const };
    const moved = chooseMySide(start, "defend", mine);
    expect(moved.mine).toBe("defend");
    expect(moved.form.defender).toMatchObject({ weapons: 12, dome: 14 });
    expect(moved.form.attacker).toEqual(start.form.attacker);
    expect(chooseMySide(start, "defend", null).form).toBe(start.form);
  });
});
