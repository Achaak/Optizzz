import { describe, expect, it } from "vitest";
import { defaultFirstArrival, schedule } from "./schedule";

const at = (time: string) => new Date(`2026-10-08T${time}:00+02:00`);

describe("schedule", () => {
  it("lands the attacks one minute apart, each leaving its travel time before", () => {
    expect(schedule(at("21:00"), [3600, 600, 5400])).toEqual([
      { departure: at("20:00"), arrival: at("21:00") },
      { departure: at("20:51"), arrival: at("21:01") },
      { departure: at("19:32"), arrival: at("21:02") },
    ]);
  });
});

describe("defaultFirstArrival", () => {
  it("is the soonest time every attack can still leave, five minutes ahead, on a multiple of five minutes", () => {
    // The third attack (1 h 30, landing 2 minutes after the first) needs the first at 10:00 + 1 h 28 + 5 min.
    expect(defaultFirstArrival(at("10:00"), [3600, 600, 5400])).toEqual(at("11:35"));
  });
});
