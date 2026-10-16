import { describe, expect, it } from "vitest";
import { watchedPlaces } from "./index";

describe("watchedPlaces", () => {
  it("watches the dome and lodge by default, the hunting field once switched on", () => {
    expect(watchedPlaces({})).toEqual(["nest", "lodge"]);
    expect(watchedPlaces({ "probes.field": true })).toEqual(["field", "nest", "lodge"]);
    expect(watchedPlaces({ "probes.nest": false })).toEqual(["lodge"]);
    expect(watchedPlaces({ probes: false })).toEqual([]);
  });
});
