import { describe, expect, it } from "vitest";
import {
  arrivalInMinute,
  beepsBetween,
  clickPhase,
  clickWindow,
  countdownText,
  arrivalText,
  driftText,
  formatSeconds,
  gameClock,
  requestDelay,
  verdictText,
  nextArrival,
  parseAimedMinute,
  serverClock,
} from "./timing";

const at = (iso: string) => Date.parse(iso);

describe("serverClock", () => {
  it("narrows the offset to what every Date header allows", () => {
    // First reply: the server was in 23:45:10 while the PC went from 10.200 to 10.600 → offset in [-600, +800).
    // Second: in 23:45:11 while the PC went from 10.900 to 11.300 → offset in [-300, +1100). Both: [-300, +800).
    const clock = serverClock([
      {
        sentAt: at("2026-11-03T23:45:10.200Z"),
        receivedAt: at("2026-11-03T23:45:10.600Z"),
        serverDate: at("2026-11-03T23:45:10Z"),
      },
      {
        sentAt: at("2026-11-03T23:45:10.900Z"),
        receivedAt: at("2026-11-03T23:45:11.300Z"),
        serverDate: at("2026-11-03T23:45:11Z"),
      },
    ]);
    expect(clock).toEqual({ offsetMs: 250, errorMs: 550, oneWayMs: 200 });
  });

  it("measures a PC clock three seconds late", () => {
    const clock = serverClock([
      {
        sentAt: at("2026-11-03T23:45:07.000Z"),
        receivedAt: at("2026-11-03T23:45:07.300Z"),
        serverDate: at("2026-11-03T23:45:10Z"),
      },
      {
        sentAt: at("2026-11-03T23:45:07.750Z"),
        receivedAt: at("2026-11-03T23:45:08.050Z"),
        serverDate: at("2026-11-03T23:45:10Z"),
      },
    ]);
    // [2700, 4000) ∩ [1950, 3250) → [2700, 3250).
    expect(clock?.offsetMs).toBe(2975);
    expect(clock?.errorMs).toBe(275);
  });

  it("falls back on the middle of each round trip when the replies disagree", () => {
    const clock = serverClock([
      { sentAt: 0, receivedAt: 200, serverDate: 5000 },
      { sentAt: 1000, receivedAt: 1200, serverDate: 4000 },
    ]);
    // Midpoint guesses: 5000 + 500 - 100 = 5400 and 4000 + 500 - 1100 = 3400.
    expect(clock?.offsetMs).toBe(4400);
    expect(clock?.errorMs).toBeGreaterThanOrEqual(1000);
  });

  it("knows nothing without a reply", () => {
    expect(serverClock([])).toBeNull();
  });
});

describe("nextArrival", () => {
  it("aims at the next :59 whose departure is at least 10 s away", () => {
    // Trip 15:09:08, server at 08:30:40.3 → departure at 08:30:51, 10.7 s away → arrival 23:39:59.
    expect(new Date(nextArrival(at("2026-11-04T08:30:40.300Z"), 54_548)).toISOString()).toBe(
      "2026-11-04T23:39:59.000Z",
    );
  });

  it("keeps a :59 whose departure is exactly 10 s away", () => {
    // Trip 8 s: arrival 10:00:59, departure 10:00:51, server at 10:00:41.
    expect(new Date(nextArrival(at("2026-11-04T10:00:41.000Z"), 8)).toISOString()).toBe("2026-11-04T10:00:59.000Z");
  });

  it("moves to the next minute once that departure is too close", () => {
    expect(new Date(nextArrival(at("2026-11-04T10:00:41.001Z"), 8)).toISOString()).toBe("2026-11-04T10:01:59.000Z");
  });
});

describe("parseAimedMinute", () => {
  it.each([
    ["23 h 40", { hours: 23, minutes: 40 }],
    ["23h40", { hours: 23, minutes: 40 }],
    ["7:05", { hours: 7, minutes: 5 }],
    [" 0 h 00 ", { hours: 0, minutes: 0 }],
  ])("reads « %s »", (text, minute) => {
    expect(parseAimedMinute(text)).toEqual(minute);
  });

  it.each(["", "24 h 00", "12 h 60", "midi", "12"])("refuses « %s »", (text) => {
    expect(parseAimedMinute(text)).toBeNull();
  });
});

describe("arrivalInMinute", () => {
  it("aims at :59 of that minute, Paris time, today", () => {
    // 23 h 40 in Paris (UTC + 1 in November) → 22:40:59 UTC.
    const arrival = arrivalInMinute({ hours: 23, minutes: 40 }, at("2026-11-04T08:30:40Z"), 3600);
    expect(new Date(arrival).toISOString()).toBe("2026-11-04T22:40:59.000Z");
  });

  it("takes tomorrow's when today's departure is gone", () => {
    // 9 h 40 Paris = 08:40:59 UTC: with a 15 h trip, its departure has passed.
    const arrival = arrivalInMinute({ hours: 9, minutes: 40 }, at("2026-11-04T08:30:40Z"), 54_548);
    expect(new Date(arrival).toISOString()).toBe("2026-11-05T08:40:59.000Z");
  });
});

describe("clickWindow", () => {
  it("centres 0.6 s on the middle of the departure second, less the way to the server, on the PC's clock", () => {
    // Arrival 23:39:59 after 15:09:08 → the server must receive the attack in 08:30:51; PC 3 s late, 150 ms away.
    const window = clickWindow(at("2026-11-04T23:39:59Z"), 54_548, { offsetMs: 3000, errorMs: 200, oneWayMs: 150 });
    expect(new Date(window.start).toISOString()).toBe("2026-11-04T08:30:48.050Z");
    expect(new Date(window.middle).toISOString()).toBe("2026-11-04T08:30:48.350Z");
    expect(new Date(window.end).toISOString()).toBe("2026-11-04T08:30:48.650Z");
  });
});

describe("clickPhase", () => {
  const window = { start: 10_000, middle: 10_300, end: 10_600 };
  it("waits before the window", () => {
    expect(clickPhase(9_000, window)).toEqual({ kind: "wait", msLeft: 1_000 });
  });
  it("says now during it, both ends included", () => {
    expect(clickPhase(10_000, window)).toEqual({ kind: "now" });
    expect(clickPhase(10_600, window)).toEqual({ kind: "now" });
  });
  it("is too late after it", () => {
    expect(clickPhase(10_601, window)).toEqual({ kind: "late" });
  });
});

describe("countdownText", () => {
  it.each([
    [10_300, "11 s"],
    [5_000, "5 s"],
    [4_310, "4,4 s"],
    [2_000, "2,0 s"],
    [40, "0,1 s"],
    [125_000, "2 min 05 s"],
    [3_725_000, "1 h 02 min 05 s"],
  ])("%i ms → « %s »", (ms, text) => {
    expect(countdownText(ms)).toBe(text);
  });
});

describe("formatSeconds", () => {
  it.each([
    [54_548, "15 h 09 min 08 s"],
    [548, "9 min 08 s"],
    [8, "8 s"],
    [3600, "1 h 00 min 00 s"],
  ])("%i s → « %s »", (seconds, text) => {
    expect(formatSeconds(seconds)).toBe(text);
  });
});

describe("beepsBetween", () => {
  it("beeps short at 3, 2 and 1 s before the middle of the window, long at the middle", () => {
    expect(beepsBetween(3_050, 2_950)).toEqual(["short"]);
    expect(beepsBetween(1_050, 950)).toEqual(["short"]);
    expect(beepsBetween(50, -50)).toEqual(["long"]);
    expect(beepsBetween(2_900, 2_800)).toEqual([]);
    expect(beepsBetween(-50, -150)).toEqual([]);
  });

  it("does not replay the beeps of a long jump (a tab put back in front)", () => {
    expect(beepsBetween(10_000, -2_000)).toEqual([]);
  });
});

describe("gameClock", () => {
  it("shows the server's time to the second, Paris time", () => {
    expect(gameClock(at("2026-11-04T07:30:40.900Z"))).toBe("08:30:40");
  });
});

describe("arrivalText", () => {
  it("writes an arrival today to the second", () => {
    expect(arrivalText(at("2026-11-04T22:39:59Z"), at("2026-11-04T07:30:40Z"))).toBe("23 h 39 min 59 s");
  });
  it("says tomorrow", () => {
    expect(arrivalText(at("2026-11-05T05:00:59Z"), at("2026-11-04T07:30:40Z"))).toBe("demain 6 h 00 min 59 s");
  });
});

describe("driftText", () => {
  it("says nothing within a second", () => {
    expect(driftText(900)).toBeNull();
    expect(driftText(-1000)).toBeNull();
  });
  it("says how late or early the PC's clock is", () => {
    expect(driftText(3_200)).toBe("Votre horloge retarde de 3 s : le bloc en tient compte.");
    expect(driftText(-1_600)).toBe("Votre horloge avance de 2 s : le bloc en tient compte.");
  });
});

describe("verdictText", () => {
  it("ticks an arrival at the aimed second", () => {
    expect(verdictText(at("2026-11-04T22:39:59Z"), at("2026-11-04T22:39:59Z"))).toEqual({
      onTime: true,
      text: "Arrivée à 23:39:59 ✓ :59 visé",
    });
  });
  it("says how late or early it arrives", () => {
    expect(verdictText(at("2026-11-04T22:40:00Z"), at("2026-11-04T22:39:59Z"))).toEqual({
      onTime: false,
      text: "Arrivée à 23:40:00 ✗ une seconde trop tard",
    });
    expect(verdictText(at("2026-11-04T22:39:56Z"), at("2026-11-04T22:39:59Z")).text).toBe(
      "Arrivée à 23:39:56 ✗ 3 secondes trop tôt",
    );
  });
});

describe("requestDelay", () => {
  it("waits so that the request reaches the server just after a second starts", () => {
    // PC 10.000 + 150 ms on the way + 300 ms offset → server at x.450: wait 750 ms to land at x.200.
    expect(requestDelay(10_000, { offsetMs: 300, errorMs: 100, oneWayMs: 150 })).toBe(750);
    expect(requestDelay(9_750, { offsetMs: 300, errorMs: 100, oneWayMs: 150 })).toBe(0);
  });
});
