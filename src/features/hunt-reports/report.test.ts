import { describe, expect, it } from "vitest";
import { HUNT_REPORT_LINES } from "@/game/army/__fixtures__/hunt-reports";
import conversationHtml from "./__fixtures__/conversation.html?raw";
import { predictLosses, readConversation, summarize, toReportLine, type HuntFight } from "./report";

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
      won: true,
      fieldWon: 118,
      food: 794,
    } satisfies HuntFight);
    expect(second?.prey).toEqual({ "Petites araignées": 18, Guèpes: 8 });
  });
});

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
      fieldPerAntLost: 240 / 9,
      offPrediction: 1,
    });
  });
});
