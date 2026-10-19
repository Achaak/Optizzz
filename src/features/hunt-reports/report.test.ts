import { describe, expect, it } from "vitest";
import { HUNT_REPORT_LINES } from "@/game/army/__fixtures__/hunt-reports";
import conversationHtml from "./__fixtures__/conversation.html?raw";
import {
  armyBalance,
  expeditionCount,
  predictLosses,
  readConversation,
  readFight,
  summarize,
  toReportLine,
  unknownEntries,
  type HuntFight,
} from "./report";

const conversation = () =>
  new DOMParser().parseFromString(conversationHtml, "text/html").querySelector(".contenu_conversation");

const fights = () => {
  const element = conversation();
  if (!element) throw new Error("fixture");
  return readConversation(element);
};

const knownLine = (date: string) =>
  HUNT_REPORT_LINES.trim()
    .split("\n")
    .find((line) => line.startsWith(date));

describe("readConversation", () => {
  it("reads every fight of an opened « Chasses » conversation, oldest first", () => {
    const [first, second] = fights();
    expect(fights()).toHaveLength(2);
    expect(first).toEqual({
      date: "07/10/26 11h08",
      sent: { JSN: 1921, SN: 119 },
      prey: { "Petites araignées": 43 },
      attackBase: 6358,
      attackBonus: 2544,
      preyKilled: 43,
      damageTaken: 56,
      antsKilled: 4,
      promoted: 5,
      promotions: { JSN: 5 },
      won: true,
      fieldWon: 118,
      food: 794,
    } satisfies HuntFight);
    expect(second?.prey).toEqual({ "Petites araignées": 18, Guèpes: 8 });
  });
});

describe("readFight", () => {
  it("reads numbers of a thousand and more, written with a space", () => {
    // 07/10/26 17h46 on s5: the game wrote « 1 199 » food and « 1 » was read. Other figures made up to cover thousands.
    const text = `Troupes en attaque : 2 135 Jeunes Soldates Naines, 146 Soldates Naines.
      Troupes en défense : 30 Petites araignées, 1 Mante religieuse.
      Vous infligez 7 104 (+ 2 842) dégâts et tuez 31 ennemies.
      L’ennemie inflige 1 230 (+ 0) dégâts à vos fourmis et en tue 14.
      Vous avez gagné cette bataille !
      Vos chasseuses ont conquis 1 183 cm², les carcasses des prédateurs vous rapportent 1 199 `;
    expect(readFight("07/10/26 17h46", text)).toMatchObject({
      sent: { JSN: 2135, SN: 146 },
      attackBase: 7104,
      damageTaken: 1230,
      fieldWon: 1183,
      food: 1199,
    });
  });
});

// 19/10/26 11h19 on s5, reported by a player: the game writes « Lezards » without its accent.
const LIZARD_HUNT = `Troupes en attaque : 5 754 Jeunes Soldates Naines, 1 225 Soldates Naines, 235 Naines d’Elites,
  8 942 Jeunes Soldates, 1 737 Soldates, 2 863 Artilleuses, 137 Artilleuses d’élites, 178 Soldates d’élites.
  Troupes en défense : 108 Petites araignées, 764 Araignées, 14 Lezards.
  Vous infligez 235 464 (+ 164 825) dégâts et tuez 886 ennemies.
  L’ennemie inflige 2 572 (+ 0) dégâts à vos fourmis et en tue 200.
  Écrasante victoire ! A peine le temps de se dégourdir les pattes qu’ils étaient tous morts ...
  Vous avez gagné cette bataille !
  Les unités survivantes ont appris de cette bataille :
  - 54 Jeunes Soldates Naines sont devenues des Soldates Naines
  - 12 Soldates Naines sont devenues des Naines d’Elites
  - 88 Jeunes Soldates sont devenues des Soldates
  - 17 Soldates sont devenues des Soldates d’élites
  - 28 Artilleuses sont devenues des Artilleuses d’élites
  Vos chasseuses ont conquis 6 115 cm², les carcasses des prédateurs vous rapportent 40 028`;

const lizardHunt = () => {
  const read = readFight("19/10/26 11h19", LIZARD_HUNT);
  if (!read) throw new Error("fixture");
  return read;
};

describe("toReportLine", () => {
  it("writes the line format of the research fixtures, without player names", () => {
    expect(fights().map(toReportLine)).toEqual([knownLine("07/10/26 11h08"), knownLine("07/10/26 12h40")]);
  });
});

describe("predictLosses", () => {
  it("replays the fight: dead ants as the report counts them, and the wounded that do not come back", () => {
    const [first] = fights();
    if (!first) throw new Error("fixture");
    // 55.9 damage on 11.2-hp young dwarves: 4 dead in the report, a 5th wounded past half its hp.
    expect(predictLosses(first, { shield: 4, cochineal: 0 })).toEqual({ dead: 4, wounded: 1 });
  });
});

describe("summarize", () => {
  it("adds up the fights and flags the ones far from the prediction", () => {
    const [first, second] = fights();
    if (!first || !second) throw new Error("fixture");
    const summary = summarize([
      { fight: first, predicted: { dead: 4, wounded: 1 } },
      { fight: second, predicted: { dead: 2, wounded: 0 } },
    ]);
    expect(summary).toEqual({
      fights: 2,
      antsKilled: 9,
      fieldWon: 240,
      food: 1614,
      offPrediction: 1,
    });
  });
});

describe("unknownEntries", () => {
  it("names the units and prey the engine does not know, to give no prediction", () => {
    const fight = readConversation(conversation() ?? document.body)[0];
    if (!fight) throw new Error("fixture");
    expect(unknownEntries(fight)).toEqual([]);
    expect(
      unknownEntries({ ...fight, sent: { ...fight.sent, Dragons: 3 }, prey: { ...fight.prey, Licornes: 1 } }),
    ).toEqual(["Dragons", "Licornes"]);
  });

  it("knows the prey the game writes without its accent", () => {
    expect(unknownEntries(lizardHunt())).toEqual([]);
    expect(predictLosses(lizardHunt(), { shield: 6, cochineal: 0 }).dead).toBeGreaterThan(0);
  });
});

describe("armyBalance", () => {
  it("weighs the dead and the promoted in attack « hors bonus » and laying time", () => {
    expect(lizardHunt().promotions).toEqual({ JSN: 54, SN: 12, JS: 88, S: 17, A: 28 });
    expect(armyBalance([lizardHunt()])).toEqual({
      // 200 dead, all from the front line: the young dwarves.
      dead: { JSN: 200 },
      deadLayingSeconds: 200 * 300,
      deadAttack: 600,
      promoted: { SN: 54, NE: 12, S: 88, SE: 17, AE: 28 },
      // 54 × 2 + 12 × 2 + 88 × 5 + 17 × 9 + 28 × 5.
      promotedAttack: 865,
    });
  });

  it("takes the dead from the next units once the front line is gone", () => {
    const fight = { ...lizardHunt(), sent: { JSN: 150, SN: 100 }, antsKilled: 200, promotions: {} };
    expect(armyBalance([fight, fight]).dead).toEqual({ JSN: 300, SN: 100 });
  });
});

describe("expeditionCount", () => {
  it("reads the number of fights in the conversation's title", () => {
    expect(expeditionCount("Vos chasseuses ont conquis 978 cm² en 191 expéditions")).toBe(191);
    expect(expeditionCount("Vos chasseuses ont conquis 23 cm² en 1 expédition")).toBe(1);
    expect(expeditionCount("Message")).toBeNull();
  });
});
