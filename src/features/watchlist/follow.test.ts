import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { storage } from "wxt/utils/storage";
import profileHtml from "@/features/history/__fixtures__/profile.html?raw";
import { loadWatchlist } from "@/data/watchlist";
import { mountProfileFollow } from "./follow";

const ORIGIN = "https://s5.fourmizzz.fr";
const HOST = "s5.fourmizzz.fr";
const VERSION = "202610171000";

const parse = (html: string) => new DOMParser().parseFromString(html, "text/html");
const control = (doc: Document) => doc.querySelector("[data-optizzz-follow]");
const link = (doc: Document, text: string) =>
  [...doc.querySelectorAll<HTMLAnchorElement>("[data-optizzz-follow] a")].find((a) => a.textContent === text);

describe("mountProfileFollow", () => {
  beforeEach(async () => {
    fakeBrowser.reset();
    const players = [
      {
        id: 42,
        pseudo: "Autre",
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
      },
    ];
    await storage.setItem(`local:allianceMap:${HOST}:playersExport`, { version: VERSION, players });
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(Response.json({ players: [VERSION], alliances: [] }))),
    );
  });

  it("adds a « Suivis » row to the profile; following shows how to see or stop", async () => {
    const doc = parse(profileHtml);
    const open = vi.fn();
    await mountProfileFollow(doc, ORIGIN, "Autre", open);
    expect(control(doc)?.closest("tr")?.textContent).toContain("Suivis :");
    await vi.waitFor(() => {
      expect(control(doc)?.textContent).toBe("Suivre");
    });

    link(doc, "Suivre")?.click();
    await vi.waitFor(() => {
      expect(control(doc)?.textContent).toBe("Dans vos suivis · Voir · Ne plus suivre");
    });
    expect(await loadWatchlist(HOST)).toEqual([
      { kind: "player", id: 42, pseudo: "Autre", seen: { version: VERSION, field: 1234 } },
    ]);

    link(doc, "Voir")?.click();
    expect(open).toHaveBeenCalledTimes(1);

    link(doc, "Ne plus suivre")?.click();
    await vi.waitFor(() => {
      expect(control(doc)?.textContent).toBe("Suivre");
    });
    expect(await loadWatchlist(HOST)).toEqual([]);
  });

  it("adds nothing for a player the export does not know yet", async () => {
    const doc = parse(profileHtml);
    await mountProfileFollow(doc, ORIGIN, "Inconnu", vi.fn());
    expect(control(doc)).toBeNull();
  });
});
