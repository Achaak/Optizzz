import { describe, expect, it } from "vitest";
import garrisonHtml from "@/data/__fixtures__/armee-move.html?raw";
import attacksHtml from "@/features/flood/__fixtures__/armee-attacks-s5.html?raw";
import ressourcesHtml from "@/features/hunt-launcher/__fixtures__/ressources-hunts.html?raw";
import { readGarrison } from "@/data/garrison";
import { armyToKeys } from "@/game/army/units";
import { readWholeArmy } from "./army";

const parse = (html: string) => new DOMParser().parseFromString(html, "text/html");
const now = new Date("2026-10-16T12:00:00Z");
/** Armee.php with Compte+: the garrison, then the attacks on their way. */
const armeePage = () => {
  const doc = parse(garrisonHtml);
  const attacks = parse(attacksHtml).querySelector("#centre center");
  doc.querySelector("#centre")?.append(...(attacks ? [...attacks.childNodes] : []));
  return doc;
};

describe("readWholeArmy", () => {
  it("adds the troops out attacking and hunting to the garrison", () => {
    const armee = armeePage();
    const garrison = readGarrison(armee);
    if (!garrison) throw new Error("fixture");
    const home = garrison.armies.field.map(
      (count, i) => count + (garrison.armies.nest[i] ?? 0) + (garrison.armies.lodge[i] ?? 0),
    );
    const whole = readWholeArmy(armee, parse(ressourcesHtml), now);
    expect(whole).toMatchObject({ attacks: 2, hunts: 2, unknown: 0 });
    const keys = armyToKeys(whole?.army ?? []);
    // Hunts: 1 975 + 300 JSN, 124 SN, 1 Tank, on top of the garrison and the attacks.
    expect(keys.Tk).toBe((armyToKeys(home).Tk ?? 0) + 1);
    expect(keys.JSN).toBeGreaterThan((armyToKeys(home).JSN ?? 0) + 2275);
  });

  it("counts the attacks and hunts whose troops are not listed", () => {
    const armee = armeePage();
    for (const note of armee.querySelectorAll("small")) note.remove();
    expect(readWholeArmy(armee, null, now)).toMatchObject({ attacks: 0, hunts: 0, unknown: 2 });
  });

  it("is null on another page", () => {
    expect(readWholeArmy(parse("<p></p>"), null, now)).toBeNull();
  });
});
