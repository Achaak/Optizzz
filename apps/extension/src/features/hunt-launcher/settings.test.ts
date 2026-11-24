import { beforeEach, describe, expect, it } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { DEFAULT_SETTINGS, forecastArrivalField, huntableArmy, readSettings, writeSettings } from "./settings";

describe("settings", () => {
  beforeEach(() => fakeBrowser.reset());

  it("starts from the defaults and remembers changes per server", async () => {
    expect(await readSettings("s5.fourmizzz.fr")).toEqual(DEFAULT_SETTINGS);
    await writeSettings("s5.fourmizzz.fr", { ...DEFAULT_SETTINGS, objective: "yield", reserve: { JSN: 100 } });
    expect((await readSettings("s5.fourmizzz.fr")).reserve).toEqual({ JSN: 100 });
    expect((await readSettings("s1.fourmizzz.fr")).objective).toBe("ratio");
  });

  it("keeps settings stored before the folding parts and the columns existed", async () => {
    await fakeBrowser.storage.local.set({
      "huntLauncher:s5.fourmizzz.fr:settings": { objective: "yield", sections: { data: false } },
    });
    const settings = await readSettings("s5.fourmizzz.fr");
    expect(settings.objective).toBe("yield");
    expect(settings.sections).toEqual({ ...DEFAULT_SETTINGS.sections, data: false });
    expect(settings.columns).toEqual(DEFAULT_SETTINGS.columns);
    expect(settings.fieldForecast).toEqual({ enabled: false, change: 0 });
  });

  it("falls back to the default objective for one that no longer exists", async () => {
    await fakeBrowser.storage.local.set({ "huntLauncher:s5.fourmizzz.fr:settings": { objective: "zero" } });
    expect((await readSettings("s5.fourmizzz.fr")).objective).toBe("ratio");
  });
});

describe("huntableArmy", () => {
  it("keeps the reserve home, never below zero", () => {
    expect(huntableArmy({ JSN: 2112, SN: 146, Tk: 0 }, { JSN: 100, SN: 500 })).toEqual({ JSN: 2012, SN: 0, Tk: 0 });
  });
});

describe("forecastArrivalField", () => {
  it("adds the hunts under way, and the forecast only when it is on", () => {
    expect(forecastArrivalField(10_000, 500, { enabled: false, change: -3_000 })).toBe(10_500);
    expect(forecastArrivalField(10_000, 500, { enabled: true, change: -3_000 })).toBe(7_500);
    expect(forecastArrivalField(10_000, 500, { enabled: true, change: 2_000 })).toBe(12_500);
  });

  it("never goes below 1 cm²", () => {
    expect(forecastArrivalField(10_000, 0, { enabled: true, change: -50_000 })).toBe(1);
  });
});
