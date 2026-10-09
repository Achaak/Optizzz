import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { loadHistory } from "./api";

const ORIGIN = "https://s5.fourmizzz.fr";

const player = (id: number, field: number) => ({
  id,
  pseudo: `P${String(id)}`,
  alliance: "UPTEP",
  masterPlayerId: null,
  x: 1,
  y: 2,
  field,
  grade: null,
  buildingScore: 30,
  technologyScore: 15,
  trophyScore: 2,
  onHoliday: false,
  isBanned: false,
});

const exports: Record<string, unknown> = {
  "202610052200": [player(1, 100), player(2, 50)],
  "202610062200": [player(1, 150)],
};

function fakeApi() {
  return vi.fn((url: string) => {
    const version = /version=(\d+)/.exec(url)?.[1] ?? "";
    const players = exports[version];
    if (players) return Promise.resolve(Response.json(players));
    return Promise.resolve(Response.json({ error: "no export" }, { status: 404 }));
  });
}

describe("loadHistory", () => {
  beforeEach(() => fakeBrowser.reset());

  it("gives each player's scores per version, in the order asked", async () => {
    vi.stubGlobal("fetch", fakeApi());
    const history = await loadHistory(ORIGIN, ["202610052200", "202610062200"]);
    expect(history.map((snapshot) => snapshot.version)).toEqual(["202610052200", "202610062200"]);
    expect(history[0]?.players.get(2)).toEqual({ field: 50, building: 30, technology: 15, trophy: 2 });
    expect(history[1]?.players.get(1)?.field).toBe(150);
    expect(history[1]?.players.has(2)).toBe(false);
  });

  it("stops downloading once aborted", async () => {
    const fetch = fakeApi();
    vi.stubGlobal("fetch", fetch);
    const run = new AbortController();
    const history = await loadHistory(ORIGIN, ["202610052200", "202610062200"], () => run.abort(), run.signal);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(history.map((snapshot) => snapshot.version)).toEqual(["202610062200"]);
  });

  it("downloads a version only once", async () => {
    const fetch = fakeApi();
    vi.stubGlobal("fetch", fetch);
    await loadHistory(ORIGIN, ["202610052200"]);
    const again = await loadHistory(ORIGIN, ["202610052200", "202610062200"]);
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      `${ORIGIN}/api/exports/players/?version=202610052200`,
      `${ORIGIN}/api/exports/players/?version=202610062200`,
    ]);
    expect(again[0]?.players.get(1)?.field).toBe(100);
  });

  it("skips a version the API cannot give", async () => {
    vi.stubGlobal("fetch", fakeApi());
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const history = await loadHistory(ORIGIN, ["202610042200", "202610052200"]);
    expect(history.map((snapshot) => snapshot.version)).toEqual(["202610052200"]);
  });

  it("reports the versions as they arrive, latest first", async () => {
    vi.stubGlobal("fetch", fakeApi());
    const progress: string[][] = [];
    await loadHistory(ORIGIN, ["202610052200", "202610062200"], (partial) =>
      progress.push(partial.map((snapshot) => snapshot.version)),
    );
    expect(progress).toEqual([["202610062200"], ["202610052200", "202610062200"]]);
  });
});
