import type { MemberStates, SharedHunt } from "@optizzz/game/sharing/shared-state";
import type { ConvoyItem } from "@optizzz/game/site-links/envoi-convoys";
import type { FloodItem } from "@optizzz/game/site-links/envoi-floods";
import { describe, expect, it } from "vitest";
import {
  allianceMovements,
  dayTimeline,
  foldPastHours,
  movementDays,
  type Movement,
  type MovementFilter,
} from "./movements";

// Tuesday 3 November 2026, 14 h 08 in Paris (UTC+1).
const NOW = new Date("2026-11-03T13:08:00Z");
const at = (iso: string) => new Date(iso).getTime();

const flood = (from: string, target: string, take: number | null, when: string): FloodItem => ({
  from,
  target,
  take,
  at: at(when),
});

const convoy = (
  kind: ConvoyItem["kind"],
  from: string,
  to: string,
  food: number,
  materials: number,
  when: string,
): ConvoyItem => ({ kind, from, to, food, materials, at: at(when) });

const hunt = (returns: string, fieldGain: number): SharedHunt => ({ returnsAt: new Date(returns), fieldGain });

const states = (pseudo: string, latest: SharedHunt[], previous?: SharedHunt[]): MemberStates => ({
  latest: { server: "s5", alliance: "4O4", pseudo, readAt: NOW, hunts: latest },
  ...(previous && { previous: { server: "s5", alliance: "4O4", pseudo, readAt: NOW, hunts: previous } }),
});

const none = { floods: [], convoys: [], states: [], now: NOW };

describe("the alliance's movements", () => {
  it("turns floods into movements toward their target, with the take the Plan expected", () => {
    expect(
      allianceMovements({ ...none, floods: [flood("Brosse", "Psycho62", 300_000, "2026-11-03T13:02:00Z")] }),
    ).toEqual([{ kind: "flood", at: at("2026-11-03T13:02:00Z"), from: "Brosse", to: "Psycho62", take: 300_000 }]);
  });

  it("keeps convoys delivered and convoys still on their way", () => {
    const moves = allianceMovements({
      ...none,
      convoys: [
        convoy("delivered", "Okapi", "Zeph", 0, 1_200_000, "2026-11-02T10:00:00Z"),
        convoy("transit", "Zeph", "XaTaK", 600_000, 0, "2026-11-03T14:12:00Z"),
      ],
    });
    expect(moves).toEqual([
      {
        kind: "convoy",
        at: at("2026-11-02T10:00:00Z"),
        from: "Okapi",
        to: "Zeph",
        food: 0,
        materials: 1_200_000,
        unconfirmed: false,
      },
      {
        kind: "convoy",
        at: at("2026-11-03T14:12:00Z"),
        from: "Zeph",
        to: "XaTaK",
        food: 600_000,
        materials: 0,
        unconfirmed: false,
      },
    ]);
  });

  it("drops a convoy arrived on the way when its delivery was read, within 5 minutes, one for one", () => {
    const moves = allianceMovements({
      ...none,
      convoys: [
        convoy("transit", "Okapi", "Zeph", 0, 500, "2026-11-03T12:00:30Z"),
        convoy("transit", "Okapi", "Zeph", 0, 500, "2026-11-03T12:01:30Z"),
        convoy("delivered", "Okapi", "Zeph", 0, 500, "2026-11-03T12:04:00Z"),
        convoy("transit", "Okapi", "Zeph", 0, 999, "2026-11-03T12:00:00Z"),
        convoy("delivered", "okapi", "zeph", 0, 999, "2026-11-03T12:06:00Z"),
      ],
    });
    // The delivery at 12 h 04 matches the nearest arrival (12 h 01 30); 12 h 06 is 6 minutes after 12 h 00.
    expect(moves.map((m) => [new Date(m.at).toISOString(), m.kind === "convoy" && m.unconfirmed])).toEqual([
      ["2026-11-03T12:00:00.000Z", true],
      ["2026-11-03T12:00:30.000Z", true],
      ["2026-11-03T12:04:00.000Z", false],
      ["2026-11-03T12:06:00.000Z", false],
    ]);
  });

  it("takes each member's hunts from their last two states, a hunt seen twice once", () => {
    const moves = allianceMovements({
      ...none,
      states: [
        states(
          "Tamo",
          [hunt("2026-11-03T13:31:00Z", 16_054)],
          [hunt("2026-11-03T13:31:00Z", 16_054), hunt("2026-11-03T09:00:00Z", 12_000)],
        ),
      ],
    });
    expect(moves).toEqual([
      { kind: "hunt", at: at("2026-11-03T09:00:00Z"), from: "Tamo", field: 12_000 },
      { kind: "hunt", at: at("2026-11-03T13:31:00Z"), from: "Tamo", field: 16_054 },
    ]);
  });
});

const move = (kind: "flood" | "hunt", when: string, from = "Brosse", to = "Psycho62", amount = 100): Movement =>
  kind === "flood" ? { kind, at: at(when), from, to, take: amount } : { kind, at: at(when), from, field: amount };

describe("the days of the « Mouvements » tab", () => {
  it("runs from 6 days ago to today in Paris when nothing arrives later", () => {
    expect(movementDays([], NOW)).toEqual([
      "2026-10-28",
      "2026-10-29",
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
      "2026-11-02",
      "2026-11-03",
    ]);
  });

  it("goes on to the last day something arrives, in Paris", () => {
    // 23 h 30 UTC on the 4th is 0 h 30 on the 5th in Paris.
    expect(movementDays([move("flood", "2026-11-04T23:30:00Z")], NOW).slice(-3)).toEqual([
      "2026-11-03",
      "2026-11-04",
      "2026-11-05",
    ]);
  });

  it("keeps a day's movements by the hour they arrive in Paris, from midnight to midnight", () => {
    const timeline = dayTimeline(
      [
        move("flood", "2026-11-02T22:59:00Z"), // 23 h 59 on the 2nd
        move("flood", "2026-11-02T23:00:00Z"), // 0 h 00 on the 3rd
        move("hunt", "2026-11-03T13:31:00Z", "Tamo"),
        move("flood", "2026-11-03T22:59:00Z"), // 23 h 59 on the 3rd
        move("flood", "2026-11-03T23:00:00Z"), // 0 h 00 on the 4th
      ],
      { day: "2026-11-03", member: null, kinds: ["flood", "convoy", "hunt"] },
    );
    expect(timeline.hours.map((h) => [h.hour, h.count])).toEqual([
      [0, 1],
      [14, 1],
      [23, 1],
    ]);
  });
});

const ALL: MovementFilter = { day: "2026-11-03", member: null, kinds: ["flood", "convoy", "hunt"] };

const convoyMove = (when: string, from: string, to: string, food: number, materials: number): Movement => ({
  kind: "convoy",
  at: at(when),
  from,
  to,
  food,
  materials,
  unconfirmed: false,
});

describe("a day of movements", () => {
  it("folds the same sender and target within an hour into one group, whatever the case", () => {
    const timeline = dayTimeline(
      [
        move("flood", "2026-11-03T13:02:00Z"),
        move("flood", "2026-11-03T13:05:00Z", "brosse", "psycho62"),
        move("flood", "2026-11-03T13:06:00Z", "Brosse", "Gargantua"),
        move("flood", "2026-11-03T14:01:00Z"),
        move("hunt", "2026-11-03T13:10:00Z", "Tamo"),
        move("hunt", "2026-11-03T13:50:00Z", "Tamo"),
      ],
      ALL,
    );
    expect(
      timeline.hours.map((h) => [
        h.hour,
        h.groups.map((g) => `${g.kind} ${g.from}→${g.to ?? ""} ×${String(g.movements.length)}`),
      ]),
    ).toEqual([
      [14, ["flood Brosse→Psycho62 ×2", "flood Brosse→Gargantua ×1", "hunt Tamo→ ×2"]],
      [15, ["flood Brosse→Psycho62 ×1"]],
    ]);
  });

  it("keeps a member's movements, sent or received, and the kinds asked", () => {
    const moves = [
      move("flood", "2026-11-03T13:02:00Z", "Brosse", "Zeph"),
      move("flood", "2026-11-03T13:03:00Z", "Zeph", "Gargantua"),
      move("flood", "2026-11-03T13:04:00Z", "Noctis", "Gargantua"),
      move("hunt", "2026-11-03T13:05:00Z", "Zeph"),
      convoyMove("2026-11-03T13:06:00Z", "Okapi", "Zeph", 10, 0),
    ];
    const shown = (filter: Partial<MovementFilter>) =>
      dayTimeline(moves, { ...ALL, ...filter }).hours.flatMap((h) => h.groups.map((g) => `${g.from}→${g.to ?? ""}`));
    expect(shown({ member: "zeph" })).toEqual(["Brosse→Zeph", "Zeph→Gargantua", "Zeph→", "Okapi→Zeph"]);
    expect(shown({ kinds: ["convoy", "hunt"] })).toEqual(["Zeph→", "Okapi→Zeph"]);
  });

  it("sums the day in tiles: floods and their take, convoys and their loads, hunts and their field", () => {
    const timeline = dayTimeline(
      [
        move("flood", "2026-11-03T08:00:00Z", "Brosse", "Psycho62", 300_000),
        { kind: "flood", at: at("2026-11-03T09:00:00Z"), from: "Noctis", to: "Viking", take: null },
        convoyMove("2026-11-03T10:00:00Z", "Okapi", "Zeph", 100, 1_200_000),
        convoyMove("2026-11-03T11:00:00Z", "Zeph", "XaTaK", 600_000, 0),
        move("hunt", "2026-11-03T12:00:00Z", "Tamo", "", 16_054),
        move("flood", "2026-11-04T08:00:00Z", "Brosse", "Psycho62", 999), // another day
      ],
      ALL,
    );
    expect(timeline.tiles).toEqual({
      flood: { count: 2, take: 300_000, withoutPlan: 1 },
      convoy: { count: 2, food: 600_100, materials: 1_200_000 },
      hunt: { count: 1, field: 16_054 },
    });
  });
});

describe("the hours already past", () => {
  const timeline = dayTimeline(
    [
      move("flood", "2026-11-03T07:00:00Z"), // 8 h
      move("flood", "2026-11-03T07:30:00Z"), // 8 h
      move("flood", "2026-11-03T10:00:00Z"), // 11 h
      move("flood", "2026-11-03T13:00:00Z"), // 14 h, the hour now
      move("flood", "2026-11-03T15:00:00Z"), // 16 h
    ],
    ALL,
  );

  it("are folded today, the hour now always shown", () => {
    const folded = foldPastHours(timeline.hours, "2026-11-03", NOW);
    expect(folded.past.map((h) => h.hour)).toEqual([8, 11]);
    expect(folded.shown.map((h) => h.hour)).toEqual([14, 16]);
  });

  it("are all shown another day", () => {
    expect(foldPastHours(timeline.hours, "2026-11-02", NOW).past).toEqual([]);
  });
});
