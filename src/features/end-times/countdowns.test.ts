import { describe, expect, it } from "vitest";
import laboratoryHtml from "../work-queue/__fixtures__/laboratory-one.html?raw";
import reineHtml from "./__fixtures__/reine-laying.html?raw";
import ressourcesHtml from "./__fixtures__/ressources-hunts.html?raw";
import { annotateCountdowns, readCountdowns } from "./countdowns";

const parse = (html: string) => new DOMParser().parseFromString(html, "text/html");
const now = new Date(2026, 9, 7, 12, 50, 0);
const endTimes = (doc: Document) =>
  [...doc.querySelectorAll(".optizzz-end-time")].map((label) => [label.previousElementSibling?.id, label.textContent]);

describe("readCountdowns", () => {
  it("reads every reste(<seconds>, id) of the page, not the game's other timers", () => {
    expect(readCountdowns(parse(reineHtml))).toEqual([
      { id: "temps_restant_premiere_ponte", seconds: 261 },
      { id: "ponte_162199", seconds: 261 },
      { id: "ponte_162200", seconds: 1262 },
      { id: "ponte_162201", seconds: 4515 },
    ]);
  });

  it("ignores the function definition", () => {
    expect(readCountdowns(parse(laboratoryHtml))).toEqual([{ id: "recherche_1791371169", seconds: 189 }]);
  });
});

describe("annotateCountdowns", () => {
  it("adds the end time right after each countdown, not after the workers' return", () => {
    const doc = parse(ressourcesHtml);
    annotateCountdowns(doc, now);
    expect(endTimes(doc)).toEqual([["chasse_143264", " · fin aujourd'hui 13 h 16"]]);
  });

  it("skips a countdown the game already gives an end time for", () => {
    const doc = parse(laboratoryHtml);
    annotateCountdowns(doc, now);
    expect(endTimes(doc)).toEqual([]);
  });

  it("annotates each laying's total time, not the first one's duplicate", () => {
    const doc = parse(reineHtml);
    annotateCountdowns(doc, now);
    expect(endTimes(doc).map(([id]) => id)).toEqual(["ponte_162199", "ponte_162200", "ponte_162201"]);
  });

  it("skips a laying whose row already has the Compte+ « Ponte finie » time", () => {
    const doc = parse(reineHtml);
    const row = doc.getElementById("ponte_162200")?.closest("tr");
    const finished = doc.createElement("td");
    finished.textContent = "13h11";
    row?.append(finished);
    annotateCountdowns(doc, now);
    expect(endTimes(doc).map(([id]) => id)).toEqual(["ponte_162199", "ponte_162201"]);
  });

  it("does not annotate twice, and refreshes the wording", () => {
    const doc = parse(ressourcesHtml);
    const { update } = annotateCountdowns(doc, now);
    update(new Date(2026, 9, 6, 12, 0, 0));
    expect(endTimes(doc)[0]).toEqual(["chasse_143264", " · fin demain 13 h 16"]);
    annotateCountdowns(doc, now);
    expect(endTimes(doc)).toHaveLength(1);
  });
});
