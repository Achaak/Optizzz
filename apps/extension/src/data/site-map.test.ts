import type { Player } from "@optizzz/game/exports";
import { encodeMapData } from "@optizzz/map/map-data";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadSiteMap } from "./site-map";

const player: Player = {
  id: 1,
  pseudo: "Rival",
  alliance: "ABC",
  masterPlayerId: null,
  x: 3,
  y: 4,
  field: 1000,
  grade: null,
  buildingScore: 10,
  technologyScore: 20,
  trophyScore: 0,
  onHoliday: false,
  isBanned: false,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("loadSiteMap", () => {
  it("reads the server's map on the site, without credentials", async () => {
    const fetch = vi.fn(() => Promise.resolve(Response.json(encodeMapData("202610221400", [player], []))));
    vi.stubGlobal("fetch", fetch);
    expect(await loadSiteMap("https://s5.fourmizzz.fr")).toEqual({
      players: { version: "202610221400", players: [player] },
      alliances: { version: "202610221400", alliances: [] },
    });
    expect(fetch).toHaveBeenCalledWith(
      "https://optizzz.fr/api/s5/carte",
      expect.objectContaining({ credentials: "omit" }),
    );
  });

  it("gives up, for the export to be read, when the site cannot answer", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(null, { status: 404 }))),
    );
    expect(await loadSiteMap("http://s2.fourmizzz.fr")).toBeNull();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(Response.json({ not: "a map" }))),
    );
    expect(await loadSiteMap("http://s2.fourmizzz.fr")).toBeNull();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("offline"))),
    );
    expect(await loadSiteMap("http://s2.fourmizzz.fr")).toBeNull();
  });

  it("does not ask the site about a server it does not know", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect(await loadSiteMap("https://s9.fourmizzz.fr")).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
});
