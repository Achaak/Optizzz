import { describe, expect, it } from "vitest";
import { countedPage, isRobot, parisDay } from "./page-views";

describe("countedPage", () => {
  it("names a page by its route, never by what fills it", () => {
    expect(countedPage("/")).toEqual({ page: "/", server: "" });
    expect(countedPage("/tools/combat")).toEqual({ page: "/tools/combat", server: "" });
    expect(countedPage("/s5/players/123")).toEqual({ page: "/[server]/players/[id]", server: "s5" });
    expect(countedPage("/S2/alliances/LGA")).toEqual({ page: "/[server]/alliances/[tag]", server: "s2" });
    expect(countedPage("/spaces/abc/declarer")).toEqual({ page: "/spaces/[id]/declarer", server: "" });
    expect(countedPage("/s5")).toEqual({ page: "/[server]", server: "s5" });
  });

  it("forgets a trailing slash", () => {
    expect(countedPage("/guides/hunt/")).toEqual({ page: "/guides/hunt", server: "" });
  });

  it("counts nothing outside the site's public pages", () => {
    expect(countedPage("/admin")).toBeNull();
    expect(countedPage("/admin/comptes")).toBeNull();
    expect(countedPage("/api/health")).toBeNull();
    expect(countedPage("/s99/map")).toBeNull();
    expect(countedPage("/tools/nothing")).toBeNull();
    expect(countedPage("/s5/players/1/more")).toBeNull();
    expect(countedPage("tools/combat")).toBeNull();
    expect(countedPage(`/${"a".repeat(300)}`)).toBeNull();
  });
});

describe("parisDay", () => {
  it("is the Paris calendar day, at midnight UTC", () => {
    expect(parisDay(new Date("2026-11-02T23:30:00Z"))).toEqual(new Date("2026-11-03T00:00:00Z"));
    expect(parisDay(new Date("2026-11-02T08:00:00Z"))).toEqual(new Date("2026-11-02T00:00:00Z"));
  });
});

describe("isRobot", () => {
  it("knows crawlers and headless browsers", () => {
    expect(isRobot("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)")).toBe(true);
    expect(isRobot("Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/131.0 Safari/537.36")).toBe(true);
    expect(isRobot(null)).toBe(true);
    expect(isRobot("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15")).toBe(false);
  });
});
