import { describe, expect, it } from "vitest";
import {
  isSiteToolId,
  siteAlliancePath,
  sitePlayerPath,
  siteServerPath,
  siteToolUrl,
  SITE_TOOLS,
  SITE_URL,
} from "./site";

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

describe("addresses of a server's pages", () => {
  it("gives the server, a player by its export id and an alliance by its tag", () => {
    expect(siteServerPath("s5")).toBe("/s5");
    expect(sitePlayerPath("s5", 42)).toBe("/s5/players/42");
    expect(siteAlliancePath("s2", "V")).toBe("/s2/alliances/V");
  });

  it("escapes a tag the address would misread", () => {
    expect(siteAlliancePath("s5", "A&B/C")).toBe("/s5/alliances/A%26B%2FC");
  });
});
