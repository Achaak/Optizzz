import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { loadAllianceHistory } from "./api";

const ORIGIN = "https://s5.fourmizzz.fr";

const alliance = (tag: string, field: number, playersCount = 10) => ({
  tag,
  name: `Alliance ${tag}`,
  playersCount,
  totalField: field,
  totalBuildingScore: 300,
  totalTechnologyScore: 150,
  totalTrophyScore: 20,
  diplomacy: { pacts: [], wars: [] },
});

const exports: Record<string, unknown> = {
  "202610052200": [alliance("UPTEP", 1000), alliance("V", 5000, 137)],
  "202610062200": [alliance("UPTEP", 1200)],
};

function fakeApi() {
  return vi.fn((url: string) => {
    const version = /version=(\d+)/.exec(url)?.[1] ?? "";
    const alliances = exports[version];
    if (alliances) return Promise.resolve(Response.json(alliances));
    return Promise.resolve(Response.json({ error: "no export" }, { status: 404 }));
  });
}

describe("loadAllianceHistory", () => {
  beforeEach(() => fakeBrowser.reset());

  it("gives each alliance's totals per version, by tag", async () => {
    vi.stubGlobal("fetch", fakeApi());
    const history = await loadAllianceHistory(ORIGIN, ["202610052200", "202610062200"]);
    expect(history.map((snapshot) => snapshot.version)).toEqual(["202610052200", "202610062200"]);
    expect(history[0]?.alliances.get("V")).toEqual({
      members: 137,
      field: 5000,
      building: 300,
      technology: 150,
      trophy: 20,
    });
    expect(history[1]?.alliances.get("UPTEP")?.field).toBe(1200);
    expect(history[1]?.alliances.has("V")).toBe(false);
  });

  it("downloads a version only once", async () => {
    const fetch = fakeApi();
    vi.stubGlobal("fetch", fetch);
    await loadAllianceHistory(ORIGIN, ["202610052200"]);
    const again = await loadAllianceHistory(ORIGIN, ["202610052200"]);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(`${ORIGIN}/api/exports/alliances/?version=202610052200`);
    expect(again[0]?.alliances.get("UPTEP")?.field).toBe(1000);
  });

  it("skips a version the API cannot give", async () => {
    vi.stubGlobal("fetch", fakeApi());
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const history = await loadAllianceHistory(ORIGIN, ["202610042200", "202610052200"]);
    expect(history.map((snapshot) => snapshot.version)).toEqual(["202610052200"]);
  });
});
