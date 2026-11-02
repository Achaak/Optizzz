import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { storage } from "wxt/utils/storage";
import alliancePageHtml from "@optizzz/game/pages/__fixtures__/alliance-page.html?raw";
import profileHtml from "@optizzz/game/pages/__fixtures__/profile.html?raw";
import { mountProfileFollow, mountAllianceFollow } from "../watchlist/follow";
import { mountAllianceSiteLink, mountProfileSiteLink } from "./mount";

const ORIGIN = "https://s5.fourmizzz.fr";
const HOST = "s5.fourmizzz.fr";
const SITE = "https://optizzz.fr";
const VERSION = "202610171000";

const parse = (html: string) => new DOMParser().parseFromString(html, "text/html");
const siteLink = (doc: Document) => doc.querySelector<HTMLAnchorElement>("[data-optizzz-site-link]");

const player = (id: number, pseudo: string) => ({
  id,
  pseudo,
  alliance: null,
  masterPlayerId: null,
  x: 0,
  y: 0,
  field: 1234,
  grade: null,
  buildingScore: 0,
  technologyScore: 0,
  trophyScore: 0,
  onHoliday: false,
  isBanned: false,
});

describe("mountProfileSiteLink", () => {
  beforeEach(async () => {
    fakeBrowser.reset();
    await storage.setItem(`local:allianceMap:${HOST}:playersExport`, {
      version: VERSION,
      players: [player(42, "Autre")],
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(Response.json({ players: [VERSION], alliances: [] }))),
    );
  });

  it("links the player's page on the site, by the export's id, in a new tab", async () => {
    const doc = parse(profileHtml);
    await mountProfileSiteLink(doc, ORIGIN, SITE, "s5", "Autre");
    const link = siteLink(doc);
    expect(link?.href).toBe("https://optizzz.fr/s5/players/42");
    expect(link?.target).toBe("_blank");
    expect(link?.closest("tr")?.textContent).toBe("Optizzz :Voir sur optizzz.fr");
  });

  it("adds nothing for a player the export does not know", async () => {
    const doc = parse(profileHtml);
    await mountProfileSiteLink(doc, ORIGIN, SITE, "s5", "Inconnu");
    expect(siteLink(doc)).toBeNull();
  });

  it("stays below « Suivis », whichever comes first, and only once", async () => {
    const rowsAfterState = (doc: Document) =>
      [...doc.querySelectorAll("tr")]
        .map((row) => row.querySelector("td")?.textContent)
        .filter((label) => label === "Suivis :" || label === "Optizzz :");

    const followFirst = parse(profileHtml);
    await mountProfileFollow(followFirst, ORIGIN, "Autre", vi.fn());
    await mountProfileSiteLink(followFirst, ORIGIN, SITE, "s5", "Autre");
    expect(rowsAfterState(followFirst)).toEqual(["Suivis :", "Optizzz :"]);

    const linkFirst = parse(profileHtml);
    await mountProfileSiteLink(linkFirst, ORIGIN, SITE, "s5", "Autre");
    await mountProfileSiteLink(linkFirst, ORIGIN, SITE, "s5", "Autre");
    await mountProfileFollow(linkFirst, ORIGIN, "Autre", vi.fn());
    expect(rowsAfterState(linkFirst)).toEqual(["Suivis :", "Optizzz :"]);
  });
});

describe("mountAllianceSiteLink", () => {
  it("links the alliance's page on the site, below its « Suivre »", () => {
    const doc = parse(alliancePageHtml);
    mountAllianceFollow(doc, ORIGIN, "V", vi.fn());
    mountAllianceSiteLink(doc, SITE, "s5", "V");
    mountAllianceSiteLink(doc, SITE, "s5", "V");
    expect(doc.querySelectorAll("[data-optizzz-site-link]")).toHaveLength(1);
    expect(siteLink(doc)?.href).toBe("https://optizzz.fr/s5/alliances/V");
    const title = doc.querySelector("#centre > h2");
    expect(title?.nextElementSibling?.querySelector("[data-optizzz-follow]")).not.toBeNull();
    expect(title?.nextElementSibling?.nextElementSibling?.contains(siteLink(doc))).toBe(true);
  });
});
