import { afterEach, describe, expect, it, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { GAME_ACCESS_PAGE, setUpGameAccess } from "./permission";

describe("setUpGameAccess", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    fakeBrowser.reset();
  });

  const update = async (granted: boolean) => {
    vi.spyOn(fakeBrowser.permissions, "contains").mockResolvedValue(granted as never);
    const create = vi.spyOn(fakeBrowser.tabs, "create").mockResolvedValue({} as never);
    setUpGameAccess();
    await fakeBrowser.runtime.onInstalled.trigger({ reason: "update", previousVersion: "1.13.0" });
    await vi.waitFor(() => {
      expect(fakeBrowser.permissions.contains).toHaveBeenCalled();
    });
    return create;
  };

  // Firefox may leave the game's pages ungranted after an update: the extension then runs only on a click.
  it("opens the page that asks for the access when it is missing after an update", async () => {
    const create = await update(false);
    await vi.waitFor(() => {
      expect(create).toHaveBeenCalledWith({ url: expect.stringContaining(GAME_ACCESS_PAGE) as string });
    });
  });

  it("opens nothing when the access is granted", async () => {
    const create = await update(true);
    await Promise.resolve();
    expect(create).not.toHaveBeenCalled();
  });
});
