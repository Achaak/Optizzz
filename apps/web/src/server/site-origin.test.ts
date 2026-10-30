import { describe, expect, it } from "vitest";
import { siteOrigin } from "./site-origin";

describe("siteOrigin", () => {
  it("takes BETTER_AUTH_URL when set, as an origin", () => {
    expect(siteOrigin({ nodeEnv: "production", betterAuthUrl: "https://optizzz.fr/" })).toBe("https://optizzz.fr");
  });

  it("falls back to localhost and the dev server's port outside production", () => {
    expect(siteOrigin({ nodeEnv: "development", port: "3100" })).toBe("http://localhost:3100");
    expect(siteOrigin({ nodeEnv: "development" })).toBe("http://localhost:3000");
  });

  it("refuses production without BETTER_AUTH_URL", () => {
    expect(() => siteOrigin({ nodeEnv: "production" })).toThrow(/BETTER_AUTH_URL/);
  });
});
