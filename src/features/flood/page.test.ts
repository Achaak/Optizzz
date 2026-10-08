import { describe, expect, it, vi } from "vitest";
import { armyFromKeys } from "@/game/army/units";
import formHtml from "./__fixtures__/attack-form.html?raw";
import profileHtml from "../history/__fixtures__/profile.html?raw";
import { readProfile } from "@/game/pages/scores";
import { fillAttackForm, onAttackSent, readAttackForm } from "./page";

const parse = (html: string) => new DOMParser().parseFromString(html, "text/html");
const input = (doc: Document, id: string) => doc.getElementById(id) as HTMLInputElement;

describe("readAttackForm", () => {
  it("reads the target and my units by place", () => {
    expect(readAttackForm(parse(formHtml))).toEqual({
      target: "Cible_1",
      targetId: 101,
      available: {
        field: armyFromKeys({ JSN: 1000, S: 50 }),
        nest: armyFromKeys({ JSN: 200 }),
        lodge: armyFromKeys({ JSN: 5000 }),
      },
    });
  });

  it("reads nothing elsewhere", () => {
    expect(readAttackForm(parse("<div id='centre'></div>"))).toBeNull();
  });
});

describe("fillAttackForm", () => {
  it("writes each unit sent and empties the others, which the game fills with the whole army", () => {
    const doc = parse(formHtml);
    fillAttackForm(doc, armyFromKeys({ JSN: 1234 }));
    expect([input(doc, "unite1").value, input(doc, "unite5").value]).toEqual(["1 234", "0"]);
    expect((doc.getElementById("lieu") as HTMLSelectElement).value).toBe("1");
  });
});

describe("onAttackSent", () => {
  it("tells the army the player sends when the game's form is submitted", () => {
    const doc = parse(formHtml);
    const sent = vi.fn();
    onAttackSent(doc, sent);
    input(doc, "unite1").value = "2k";
    input(doc, "unite5").value = "1 0";
    const form = doc.getElementById("formulaireChoixArmee") as HTMLFormElement;
    form.addEventListener("submit", (event) => {
      event.preventDefault();
    });
    form.dispatchEvent(new Event("submit", { cancelable: true }));
    expect(sent).toHaveBeenCalledWith({ army: armyFromKeys({ JSN: 2000, S: 10 }), place: "field" });
  });
});

describe("profile", () => {
  it("is read by the shared profile reader, the live hunting field included", () => {
    expect(readProfile(parse(profileHtml))?.scores.field).toBe(1206299);
  });
});
