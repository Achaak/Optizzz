import { describe, expect, it } from "vitest";
import { isSiteToolId, siteToolUrl, SITE_TOOLS, SITE_URL } from "./site";

describe("address of a site tool", () => {
  it("puts the state in the fragment of the tool's English address", () => {
    expect(siteToolUrl("combat", "1.eyJhIjoxfQ")).toBe(`${SITE_URL}/tools/combat#p=1.eyJhIjoxfQ`);
    expect(siteToolUrl("hunt")).toBe("https://optizzz.fr/tools/hunt");
  });

  it("knows the five tools and nothing else", () => {
    expect(SITE_TOOLS).toEqual(["travel", "costs", "combat", "hunt", "flood"]);
    expect(isSiteToolId("flood")).toBe(true);
    expect(isSiteToolId("map")).toBe(false);
    expect(isSiteToolId(undefined)).toBe(false);
  });

  it("refuses a state that is not one, rather than writing it into the address", () => {
    expect(() => siteToolUrl("costs", "1.a#b")).toThrow();
    expect(() => siteToolUrl("costs", "1.a&q=b")).toThrow();
  });
});
