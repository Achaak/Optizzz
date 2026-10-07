import { beforeEach, describe, expect, it } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { DEFAULT_SETTINGS, huntableArmy, readSettings, writeSettings } from "./settings";

describe("settings", () => {
  beforeEach(() => fakeBrowser.reset());

  it("starts from the defaults and remembers changes per server", async () => {
    expect(await readSettings("s5.fourmizzz.fr")).toEqual(DEFAULT_SETTINGS);
    await writeSettings("s5.fourmizzz.fr", { ...DEFAULT_SETTINGS, objective: "yield", reserve: { JSN: 100 } });
    expect((await readSettings("s5.fourmizzz.fr")).reserve).toEqual({ JSN: 100 });
    expect((await readSettings("s1.fourmizzz.fr")).objective).toBe("yield");
  });

  it("falls back to the default objective for one that no longer exists", async () => {
    await fakeBrowser.storage.local.set({ "huntLauncher:s5.fourmizzz.fr:settings": { objective: "zero" } });
    expect((await readSettings("s5.fourmizzz.fr")).objective).toBe("yield");
  });
});

describe("huntableArmy", () => {
  it("keeps the reserve home, never below zero", () => {
    expect(huntableArmy({ JSN: 2112, SN: 146, Tk: 0 }, { JSN: 100, SN: 500 })).toEqual({ JSN: 2012, SN: 0, Tk: 0 });
  });
});
