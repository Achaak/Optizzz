import { describe, expect, it } from "vitest";
import { resolveSiteOrigin, siteOriginPattern } from "./site-origin";

const SITE = "https://optizzz.fr";

describe("the site the extension talks to", () => {
  it("is optizzz.fr unless WXT_SITE_URL says otherwise", () => {
    expect(resolveSiteOrigin(undefined, "production", SITE)).toBe(SITE);
    expect(resolveSiteOrigin("", "development", SITE)).toBe(SITE);
    expect(resolveSiteOrigin("https://optizzz.fr/", "production", SITE)).toBe(SITE);
  });

  it("is a local site while developing, in plain http on this machine", () => {
    expect(resolveSiteOrigin("http://localhost:3000", "development", SITE)).toBe("http://localhost:3000");
    expect(resolveSiteOrigin("http://127.0.0.1:3018/", "development", SITE)).toBe("http://127.0.0.1:3018");
    expect(resolveSiteOrigin("https://preview.example.com", "development", SITE)).toBe("https://preview.example.com");
  });

  it("refuses another site in a production build, so that no store build talks to it", () => {
    expect(() => resolveSiteOrigin("http://localhost:3000", "production", SITE)).toThrow(/production build/);
  });

  it("refuses plain http away from this machine, a path, or what is not an address", () => {
    expect(() => resolveSiteOrigin("http://example.com", "development", SITE)).toThrow(/https/);
    expect(() => resolveSiteOrigin("http://localhost:3000/account", "development", SITE)).toThrow(/origin/);
    expect(() => resolveSiteOrigin("localhost:3000", "development", SITE)).toThrow();
  });

  it("asks for every port of the site's host, as match patterns cannot name one", () => {
    expect(siteOriginPattern(SITE)).toBe("https://optizzz.fr/*");
    expect(siteOriginPattern("http://localhost:3000")).toBe("http://localhost/*");
  });
});
