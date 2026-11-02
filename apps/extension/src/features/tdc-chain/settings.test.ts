import { beforeEach, describe, expect, it } from "vitest";
import { storage } from "wxt/utils/storage";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { readChainSettings } from "./settings";

describe("readChainSettings", () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it("reads a granary stored before the granaries had ranks as Grenier 1", async () => {
    await storage.setItem("local:tdcChain:s1.fourmizzz.fr:settings", {
      roles: { "1": { kind: "granary" }, "2": { kind: "granary", rank: 2 }, "3": { kind: "hunter" } },
    });
    expect((await readChainSettings("s1.fourmizzz.fr")).roles).toEqual({
      "1": { kind: "granary", rank: 1 },
      "2": { kind: "granary", rank: 2 },
      "3": { kind: "hunter" },
    });
  });
});
