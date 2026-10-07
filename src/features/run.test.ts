import { describe, expect, it, vi } from "vitest";
import type { ContentScriptContext } from "wxt/utils/content-script-context";
import type { Feature } from "./feature";
import { runFeatures } from "./run";

const ctx = {} as ContentScriptContext;
const url = new URL("https://s5.fourmizzz.fr/construction.php");

const feature = (id: string, extra: Partial<Feature> = {}): Feature => ({
  id,
  matches: () => true,
  run: vi.fn(),
  ...extra,
});

describe("runFeatures", () => {
  it("skips a feature whose toggle is off, and runs the ones without toggle", async () => {
    const queue = feature("work-queue", { toggle: "work-queue" });
    const settings = feature("settings-menu");
    await runFeatures([queue, settings], url, { "work-queue": false }, ctx);
    expect(queue.run).not.toHaveBeenCalled();
    expect(settings.run).toHaveBeenCalledOnce();
  });

  it("passes the toggles on, for the feature's options", async () => {
    const forecast = feature("resource-forecast", { toggle: "resource-forecast" });
    const toggles = { "resource-forecast.costs": false };
    await runFeatures([forecast], url, toggles, ctx);
    expect(forecast.run).toHaveBeenCalledWith(ctx, toggles);
  });

  it("skips features that do not match the page", async () => {
    const other = feature("other", { matches: () => false });
    await runFeatures([other], url, {}, ctx);
    expect(other.run).not.toHaveBeenCalled();
  });

  it("keeps going when a feature throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const broken = feature("broken", { run: () => Promise.reject(new Error("boom")) });
    const next = feature("next");
    await runFeatures([broken, next], url, {}, ctx);
    expect(next.run).toHaveBeenCalledOnce();
  });
});
