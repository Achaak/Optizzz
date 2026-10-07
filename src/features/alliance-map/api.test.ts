import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { loadPlayersExport } from "./api";

const ORIGIN = "https://s5.fourmizzz.fr";

const player = {
  id: 1235,
  pseudo: "Achak",
  alliance: "UPTEP",
  masterPlayerId: null,
  x: 21,
  y: 38,
  field: 3778,
  grade: "Fou du bus",
  buildingScore: 36,
  technologyScore: 16,
  trophyScore: 0,
  onHoliday: false,
  isBanned: false,
};

function fakeApi(versions: string[], players: unknown = [player]) {
  return vi.fn((url: string) => {
    if (url === `${ORIGIN}/api/exports/`) {
      return Promise.resolve(Response.json({ players: versions, alliances: versions }));
    }
    if (url === `${ORIGIN}/api/exports/players/?version=${versions[0] ?? ""}`) {
      return Promise.resolve(Response.json(players));
    }
    return Promise.resolve(Response.json({ error: "unknown" }, { status: 404 }));
  });
}

describe("loadPlayersExport", () => {
  beforeEach(() => fakeBrowser.reset());

  it("downloads the latest players version", async () => {
    vi.stubGlobal("fetch", fakeApi(["202610062200", "202610052200"]));
    const playersExport = await loadPlayersExport(ORIGIN);
    expect(playersExport.version).toBe("202610062200");
    expect(playersExport.players).toEqual([player]);
  });

  it("does not download a cached version again", async () => {
    const fetch = fakeApi(["202610062200"]);
    vi.stubGlobal("fetch", fetch);
    await loadPlayersExport(ORIGIN);
    await loadPlayersExport(ORIGIN);
    const downloads = fetch.mock.calls.filter(([url]) => url.includes("/players/"));
    expect(downloads).toHaveLength(1);
  });

  it("updates when a new version is published", async () => {
    vi.stubGlobal("fetch", fakeApi(["202610052200"]));
    await loadPlayersExport(ORIGIN);
    vi.stubGlobal("fetch", fakeApi(["202610062200"], [{ ...player, x: 1 }]));
    const playersExport = await loadPlayersExport(ORIGIN);
    expect(playersExport.version).toBe("202610062200");
    expect(playersExport.players[0]?.x).toBe(1);
  });

  it("keeps one cache per server", async () => {
    vi.stubGlobal("fetch", fakeApi(["202610062200"]));
    await loadPlayersExport(ORIGIN);
    const other = fakeApi(["202610062200"]);
    vi.stubGlobal("fetch", (url: string) => other(url.replace("http://s1.fourmizzz.fr", ORIGIN)));
    await loadPlayersExport("http://s1.fourmizzz.fr");
    expect(other.mock.calls.some(([url]) => url.includes("/players/"))).toBe(true);
  });

  it("falls back to the cache when the API is unreachable", async () => {
    vi.stubGlobal("fetch", fakeApi(["202610062200"]));
    await loadPlayersExport(ORIGIN);
    vi.stubGlobal("fetch", () => Promise.resolve(Response.json({ error: "outage" }, { status: 502 })));
    expect((await loadPlayersExport(ORIGIN)).version).toBe("202610062200");
  });

  it("rejects a file that breaks the contract", async () => {
    vi.stubGlobal("fetch", fakeApi(["202610062200"], [{ id: "not a number" }]));
    await expect(loadPlayersExport(ORIGIN)).rejects.toThrow();
  });
});
