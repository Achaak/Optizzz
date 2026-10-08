import { describe, expect, it } from "vitest";
import armeeHtml from "./__fixtures__/armee-attacks.html?raw";
import { readAttacksOnWay, reconcileLaunches } from "./attacks";

const now = new Date(2026, 9, 8, 10, 0, 0);
const at = (minutes: number, seconds = 0) => new Date(now.getTime() + (minutes * 60 + seconds) * 1000);
const launch = (target: string, arrivesAt: Date, take = 100) => ({ targetId: 1, target, ants: take, take, arrivesAt });

describe("readAttacksOnWay", () => {
  it("reads the target and the arrival of each attack the game lists", () => {
    const doc = new DOMParser().parseFromString(armeeHtml, "text/html");
    expect(readAttacksOnWay(doc, now)).toEqual([
      { target: "Cible_1", arrivesAt: at(9, 7) },
      { target: "Cible_2", arrivesAt: at(62) },
    ]);
  });

  it("reads none when nothing is on its way", () => {
    expect(readAttacksOnWay(new DOMParser().parseFromString("<div id='centre'></div>", "text/html"), now)).toEqual([]);
  });
});

describe("reconcileLaunches", () => {
  it("forgets an attack the game no longer lists: it was cancelled", () => {
    const sent = [launch("Cible_1", at(9)), launch("Cible_1", at(12))];
    const result = reconcileLaunches(sent, [{ target: "Cible_1", arrivesAt: at(9, 7) }]);
    expect(result.launches).toEqual([launch("Cible_1", at(9, 7))]);
    expect(result.unknown).toBe(0);
  });

  it("keeps the game's arrival time, and counts the attacks sent without Optizzz", () => {
    const result = reconcileLaunches(
      [launch("Cible_1", at(10))],
      [
        { target: "Cible_1", arrivesAt: at(9, 7) },
        { target: "Cible_2", arrivesAt: at(62) },
      ],
    );
    expect(result.launches).toEqual([launch("Cible_1", at(9, 7))]);
    expect(result.unknown).toBe(1);
  });

  it("pairs each attack with the launch arriving nearest, target by target", () => {
    const sent = [launch("Cible_1", at(9), 400), launch("Cible_1", at(20), 320), launch("cible_1", at(31), 256)];
    const result = reconcileLaunches(sent, [
      { target: "Cible_1", arrivesAt: at(9, 30) },
      { target: "Cible_1", arrivesAt: at(30, 30) },
    ]);
    expect(result.launches.map((kept) => kept.take)).toEqual([400, 256]);
  });
});
