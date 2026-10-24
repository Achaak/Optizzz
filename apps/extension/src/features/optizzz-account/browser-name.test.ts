import { describe, expect, it } from "vitest";
import { browserName } from "./browser-name";

describe("browserName", () => {
  it("names the browser from the build and the user agent, never with the user agent itself", () => {
    expect(browserName("Mozilla/5.0 … Firefox/142.0", true)).toBe("Firefox");
    expect(browserName("Mozilla/5.0 … Chrome/141.0 Safari/537.36 Edg/141.0", false)).toBe("Edge");
    expect(browserName("Mozilla/5.0 … Chrome/141.0 Safari/537.36 OPR/120.0", false)).toBe("Opera");
    expect(browserName("Mozilla/5.0 … Chrome/141.0 Safari/537.36", false)).toBe("Chrome");
  });
});
