import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { storage } from "wxt/utils/storage";
import { loadAlliancesExport, loadPlayersExport } from "./api";

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

const alliance = {
  tag: "UPTEP",
  name: "Un P'tit Truc En Plus",
  playersCount: 15,
  totalField: 63211,
  totalBuildingScore: 497,
  totalTechnologyScore: 236,
  totalTrophyScore: 0,
  diplomacy: { pacts: [{ tag: "LHDM", name: "PNA ", description: "PNA de 1 mois " }], wars: [] },
};

function fakeAlliancesApi(versions: string[], alliances: unknown = [alliance]) {
  return vi.fn((url: string) => {
    if (url === `${ORIGIN}/api/exports/`) {
      return Promise.resolve(Response.json({ players: versions, alliances: versions }));
    }
    if (url === `${ORIGIN}/api/exports/alliances/?version=${versions[0] ?? ""}`) {
      return Promise.resolve(Response.json(alliances));
    }
    return Promise.resolve(Response.json({ error: "unknown" }, { status: 404 }));
  });
}

describe("loadAlliancesExport", () => {
  beforeEach(() => fakeBrowser.reset());

  it("downloads the latest alliances version once", async () => {
    const fetch = fakeAlliancesApi(["202610071900"]);
    vi.stubGlobal("fetch", fetch);
    await loadAlliancesExport(ORIGIN);
    const alliancesExport = await loadAlliancesExport(ORIGIN);
    expect(alliancesExport).toEqual({ version: "202610071900", alliances: [alliance] });
    expect(fetch.mock.calls.filter(([url]) => url.includes("/alliances/"))).toHaveLength(1);
  });

  it("falls back to the cache when the API is unreachable", async () => {
    vi.stubGlobal("fetch", fakeAlliancesApi(["202610071900"]));
    await loadAlliancesExport(ORIGIN);
    vi.stubGlobal("fetch", () => Promise.resolve(Response.json({ error: "outage" }, { status: 503 })));
    expect((await loadAlliancesExport(ORIGIN)).version).toBe("202610071900");
  });

  it("still answers when the cache cannot be written (storage quota)", async () => {
    vi.stubGlobal("fetch", fakeAlliancesApi(["202610071900"]));
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const setItem = vi.spyOn(storage, "setItem").mockRejectedValue(new Error("Resource::kQuotaBytes quota exceeded"));
    expect((await loadAlliancesExport(ORIGIN)).alliances).toEqual([alliance]);
    setItem.mockRestore();
  });

  it("rejects a file that breaks the contract", async () => {
    vi.stubGlobal("fetch", fakeAlliancesApi(["202610071900"], [{ tag: 3 }]));
    await expect(loadAlliancesExport(ORIGIN)).rejects.toThrow();
  });
});
