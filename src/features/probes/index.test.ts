import { beforeEach, describe, expect, it } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { armyFromKeys } from "@/game/army/units";
import { loadProbePlan } from "./index";

describe("loadProbePlan", () => {
  beforeEach(() => fakeBrowser.reset());

  it("keeps one JSN on the Dôme and the Loge by default, nothing while the feature is off", async () => {
    expect(await loadProbePlan({})).toEqual({ nest: armyFromKeys({ JSN: 1 }), lodge: armyFromKeys({ JSN: 1 }) });
    expect(await loadProbePlan({ probes: false })).toEqual({});
  });
});
