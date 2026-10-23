import { fromParisParts } from "@optizzz/game/format/time-format";
import { distance, travelTime } from "@optizzz/game/travel";
import { describe, expect, it } from "vitest";
import { departureTime, endPoint, travelResult } from "./travel-result";

const formica = { x: 55, y: 28 };
const atta = { x: 35, y: 8 };
const now = fromParisParts({ year: 2026, month: 10, day: 23, hours: 13, minutes: 0 });

describe("a trip", () => {
  // Measured on the game's profile of Atta from Formica (docs/research/temps-de-trajet.md):
  // « Distance : 29 », « Temps de trajet : 10H 1m 2s ».
  it("reads as the game's profile: distance rounded up, time rounded down", () => {
    const trip = travelResult({ from: formica, to: atta, attackSpeed: 3, departure: now, now });
    expect(trip.distance).toBe(29);
    expect(trip.seconds).toBe(36_062);
    expect(trip.time).toBe("10H 1m 2s");
  });

  it("gives the extension's time for the same ends and level (the same shared formula)", () => {
    // The ends and levels the extension's trips are computed from (members' list, targets, convoys, flood plan).
    const cases = [
      { from: formica, to: { x: 54, y: 31 }, level: 0 },
      { from: formica, to: atta, level: 3 },
      { from: { x: 0, y: 0 }, to: { x: 400, y: 300 }, level: 12 },
      { from: atta, to: atta, level: 5 },
    ];
    for (const { from, to, level } of cases) {
      const trip = travelResult({ from, to, attackSpeed: level, departure: now, now });
      expect(trip.seconds).toBe(travelTime(distance(from, to), level));
      expect(trip.arrival.getTime()).toBe(now.getTime() + trip.seconds * 1000);
    }
  });

  it("is the same both ways", () => {
    const there = travelResult({ from: formica, to: atta, attackSpeed: 7, departure: now, now });
    const back = travelResult({ from: atta, to: formica, attackSpeed: 7, departure: now, now });
    expect(back.seconds).toBe(there.seconds);
  });

  it("arrives at a Paris time written like Optizzz, from now or from a given departure", () => {
    // 1 h 35 min 32 s from Formica to Messor (d = 3,16), Attack Speed 0.
    const convoy = { from: formica, to: { x: 54, y: 31 }, attackSpeed: 0 };
    expect(travelResult({ ...convoy, departure: now, now }).arrivalText).toBe("aujourd'hui 14 h 35");
    const evening = fromParisParts({ year: 2026, month: 10, day: 23, hours: 23, minutes: 30 });
    expect(travelResult({ ...convoy, departure: evening, now }).arrivalText).toBe("demain 1 h 05");
  });

  it("is instant on the spot", () => {
    const trip = travelResult({ from: atta, to: atta, attackSpeed: 0, departure: now, now });
    expect(trip).toMatchObject({ distance: 0, seconds: 0, time: "0s" });
  });
});

describe("an end of the trip", () => {
  it("is a position once both x and y are typed", () => {
    expect(endPoint({ kind: "position", x: 3, y: 4 }, null)).toEqual({ x: 3, y: 4 });
    expect(endPoint({ kind: "position", x: 3, y: null }, null)).toBeNull();
    expect(endPoint(null, null)).toBeNull();
  });

  it("is the player's position once read from the site's database", () => {
    const player = { server: "s5", id: 1, pseudo: "Atta", alliance: null, field: 10, ...atta };
    expect(endPoint({ kind: "player", id: 1 }, player)).toEqual(atta);
    expect(endPoint({ kind: "player", id: 1 }, undefined)).toBeNull();
    expect(endPoint({ kind: "player", id: 1 }, null)).toBeNull();
  });
});

describe("the departure", () => {
  it("is now by default", () => {
    expect(departureTime(null, now)).toBe(now);
  });

  it("is a day and time of Paris, whatever the visitor's clock", () => {
    expect(departureTime("2026-10-23T20:15", now)).toEqual(
      fromParisParts({ year: 2026, month: 10, day: 23, hours: 20, minutes: 15 }),
    );
    // Summer time: Paris is UTC+2.
    expect(departureTime("2026-07-14T08:00", now).toISOString()).toBe("2026-07-14T06:00:00.000Z");
  });
});
