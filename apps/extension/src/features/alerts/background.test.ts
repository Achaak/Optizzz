import { afterEach, describe, expect, it, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { setUpAlerts } from "./background";

describe("setUpAlerts", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Firefox keeps `browser.notifications` as a key set to undefined until the optional permission is granted: the
  // background must still start, or every listener set up after it (the Optizzz account…) is missing.
  it("starts while browser.notifications is undefined", () => {
    vi.spyOn(fakeBrowser, "notifications", "get").mockReturnValue(undefined as never);
    expect("notifications" in fakeBrowser).toBe(true);
    vi.spyOn(fakeBrowser.permissions.onAdded, "addListener").mockImplementation(() => undefined);
    expect(() => {
      setUpAlerts();
    }).not.toThrow();
  });
});
