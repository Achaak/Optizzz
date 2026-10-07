import { beforeEach, describe, expect, it } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { isEnabled, isFeatureEnabled, loadToggles, setToggle } from "./toggles";

describe("isEnabled", () => {
  it("treats a missing key as enabled", () => {
    expect(isEnabled({}, "work-queue")).toBe(true);
    expect(isEnabled({}, "resource-forecast", "costs")).toBe(true);
  });

  it("reads a switched-off feature", () => {
    expect(isEnabled({ "work-queue": false }, "work-queue")).toBe(false);
  });

  it("switches an option off with its feature, whatever the option's own state", () => {
    const toggles = { "resource-forecast": false, "resource-forecast.costs": true };
    expect(isEnabled(toggles, "resource-forecast", "costs")).toBe(false);
  });

  it("switches one option off and keeps the others", () => {
    const toggles = { "resource-forecast.costs": false };
    expect(isEnabled(toggles, "resource-forecast", "costs")).toBe(false);
    expect(isEnabled(toggles, "resource-forecast", "outlook")).toBe(true);
    expect(isEnabled(toggles, "resource-forecast")).toBe(true);
  });
});

describe("toggle storage", () => {
  beforeEach(() => fakeBrowser.reset());

  it("starts with everything on", async () => {
    expect(await loadToggles()).toEqual({});
    expect(await isFeatureEnabled("hunt-launcher")).toBe(true);
  });

  it("remembers a feature switched off, then on again", async () => {
    await setToggle("hunt-launcher", undefined, false);
    expect(await isFeatureEnabled("hunt-launcher")).toBe(false);
    await setToggle("hunt-launcher", undefined, true);
    expect(await isFeatureEnabled("hunt-launcher")).toBe(true);
  });

  it("keeps an option's state while its feature is off", async () => {
    await setToggle("resource-forecast", "simulator", false);
    await setToggle("resource-forecast", undefined, false);
    await setToggle("resource-forecast", undefined, true);
    const toggles = await loadToggles();
    expect(isEnabled(toggles, "resource-forecast", "simulator")).toBe(false);
    expect(isEnabled(toggles, "resource-forecast", "costs")).toBe(true);
  });
});
