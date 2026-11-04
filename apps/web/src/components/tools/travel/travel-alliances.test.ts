import { fromParisParts } from "@optizzz/game/format/time-format";
import { distance, travelTime } from "@optizzz/game/travel";
import { describe, expect, it } from "vitest";
import { allianceTrips, rangeWord, tripsText, type AllianceMember, type Sender } from "./travel-alliances";

const now = fromParisParts({ year: 2026, month: 10, day: 23, hours: 13, minutes: 0 });
const formica = { x: 55, y: 28 };

const member = (pseudo: string, x: number, y: number, field: number, more: Partial<AllianceMember> = {}) => ({
  id: pseudo.length * 1000 + x * 10 + y,
  pseudo,
  alliance: "C6P",
  x,
  y,
  field,
  onHoliday: false,
  ...more,
});

const atta = member("Atta", 35, 8, 900_000);
const messor = member("Messor", 54, 31, 400_000, { alliance: "NOX" });
const lasius = member("Lasius", 60, 28, 3_000_000, { onHoliday: true });

const trips = (members: AllianceMember[], sender: Sender = { ...formica, id: 1, field: 1_000_000 }) =>
  allianceTrips({ sender, members, attackSpeed: 3, departure: now, now });

describe("the trips towards alliances", () => {
  it("go from the closest member to the farthest, each with the extension's time", () => {
    const rows = trips([atta, messor, lasius]);
    expect(rows.map((row) => row.pseudo)).toEqual(["Messor", "Lasius", "Atta"]);
    for (const row of rows) {
      expect(row.seconds).toBe(travelTime(distance(formica, row), 3));
      expect(row.arrival.getTime()).toBe(now.getTime() + row.seconds * 1000);
    }
  });

  it("read as the game's profile: distance rounded up, time rounded down", () => {
    const [trip] = trips([atta]);
    expect(trip).toMatchObject({ distance: 29, seconds: 36_062, time: "10H 1m 2s", alliance: "C6P" });
  });

  it("leave the sender out when they are a member of an alliance chosen", () => {
    const sender = member("Formica", 55, 28, 1_000_000);
    expect(trips([atta, sender], sender).map((row) => row.pseudo)).toEqual(["Atta"]);
  });

  it("put two members as far away in the order of their pseudo", () => {
    const twin = member("Aphaenogaster", 35, 8, 900_000);
    expect(trips([atta, twin]).map((row) => row.pseudo)).toEqual(["Aphaenogaster", "Atta"]);
  });
});

describe("the attack range", () => {
  it("follows the sender's field: from 50 % (included) to 300 % (excluded)", () => {
    const rows = trips([
      member("Half", 1, 1, 500_000),
      member("Under", 2, 2, 499_999),
      member("Triple", 3, 3, 3_000_000),
      member("Under triple", 4, 4, 2_999_999),
    ]);
    const range = Object.fromEntries(rows.map((row) => [row.pseudo, row.range]));
    expect(range).toEqual({ Half: "in", Under: "small", Triple: "big", "Under triple": "in" });
  });

  it("is not known from a position", () => {
    const rows = trips([atta], { ...formica, id: null, field: null });
    expect(rows[0]?.range).toBeNull();
  });

  it("is told in words, holidays too", () => {
    const [messorTrip, lasiusTrip] = trips([messor, lasius]);
    expect(messorTrip && rangeWord(messorTrip)).toBe("trop petit");
    expect(lasiusTrip && rangeWord(lasiusTrip)).toBe("trop gros · en vacances");
    const [fromPosition] = trips([lasius], { ...formica, id: null, field: null });
    expect(fromPosition && rangeWord(fromPosition)).toBe("en vacances");
  });
});

describe("the table copied", () => {
  it("is one line per member, to paste on Discord", () => {
    expect(tripsText(trips([atta, messor]))).toBe(
      [
        "Messor · NOX · 4 cases · 1H 9m 38s · arrivée aujourd'hui 14 h 09",
        "Atta · C6P · 29 cases · 10H 1m 2s · arrivée aujourd'hui 23 h 01",
      ].join("\n"),
    );
  });
});
