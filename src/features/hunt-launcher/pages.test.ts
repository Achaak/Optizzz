import { describe, expect, it } from "vitest";
import huntFormHtml from "./__fixtures__/hunt-form.html?raw";
import ressourcesHuntsHtml from "./__fixtures__/ressources-hunts.html?raw";
import ressourcesHtml from "../resource-forecast/__fixtures__/ressources.html?raw";
import { hasNoArmyToSend, readHuntForm, readOngoingHunts } from "./pages";

const parse = (html: string) => new DOMParser().parseFromString(html, "text/html");
const now = new Date(2026, 9, 7, 12, 7, 0);

describe("readHuntForm", () => {
  const form = readHuntForm(parse(huntFormHtml));

  it("reads every unit the hunt form offers, all places together", () => {
    expect(form?.available).toMatchObject({ JSN: 2112, SN: 156, Tk: 5 });
    expect(form?.available.NE).toBe(0);
  });

  it("tells where the units are", () => {
    expect(form?.byPlace.JSN).toEqual({ field: 0, nest: 2042, lodge: 70 });
    expect(form?.byPlace.SN).toEqual({ field: 10, nest: 146, lodge: 0 });
  });

  it("keeps the hidden fields and the submit button to post them back", () => {
    expect(form?.hiddenFields).toEqual({ t: "TOKEN", pseudoCible: "" });
    expect(form?.submit).toEqual({ name: "ChoixArmee", value: "Lancer la Chasse !" });
  });

  it("finds nothing on a page without the form (logged out)", () => {
    expect(readHuntForm(parse("<form action='index.php'></form>"))).toBeNull();
  });
});

describe("readOngoingHunts", () => {
  it("reads each hunt with its gain, return time and, with Compte+, its troops", () => {
    expect(readOngoingHunts(parse(ressourcesHuntsHtml), now)).toEqual([
      {
        id: "chasse_139778",
        fieldGain: 122,
        returnsAt: new Date(now.getTime() + 1090_000),
        troops: { JSN: 1975, SN: 124 },
      },
      {
        id: "chasse_139779",
        fieldGain: 1250,
        returnsAt: new Date(now.getTime() + 3725_000),
        troops: { JSN: 300, Tk: 1 },
      },
    ]);
  });

  it("reads the hunt of the resource forecast fixture too", () => {
    const [hunt] = readOngoingHunts(parse(ressourcesHtml), now);
    expect(hunt?.fieldGain).toBe(122);
  });
});

describe("hasNoArmyToSend", () => {
  it("tells the page without army apart from an unreadable one", () => {
    const noArmy = parse(
      `<div id="centre"><form action="AcquerirTerrain.php">Vous n'avez pas d'armée a envoyer.</form></div>`,
    );
    expect(readHuntForm(noArmy)).toBeNull();
    expect(hasNoArmyToSend(noArmy)).toBe(true);
    expect(hasNoArmyToSend(parse("<p>Erreur</p>"))).toBe(false);
    expect(hasNoArmyToSend(parse(huntFormHtml))).toBe(false);
  });
});
