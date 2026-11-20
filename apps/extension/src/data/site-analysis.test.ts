import { afterEach, describe, expect, it, vi } from "vitest";
import type { PlayerAnalysis } from "@optizzz/game/analysis/player-analysis";
import { loadAllianceFloods, loadPlayerAnalysis } from "./site-analysis";

const grid = () => Array.from({ length: 7 }, () => Array<number>(24).fill(0));
const analysis: PlayerAnalysis = {
  days: 28,
  quietHours: { from: 2, to: 9 },
  grid: { rises: grid(), falls: grid() },
  floods: [
    {
      since: "2026-11-20T12:05:00.000Z",
      at: "2026-11-20T13:05:00.000Z",
      direction: "lost",
      amount: 1000,
      others: [{ id: 2, pseudo: "Lunaire", alliance: "AP" }],
      alliance: "AP",
      sureness: "sure",
      inside: false,
    },
  ],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("loadPlayerAnalysis", () => {
  it("reads a player's hourly analysis on the site, without credentials", async () => {
    const fetch = vi.fn(() => Promise.resolve(Response.json(analysis)));
    vi.stubGlobal("fetch", fetch);
    expect(await loadPlayerAnalysis("https://s5.fourmizzz.fr", 42)).toEqual(analysis);
    expect(fetch).toHaveBeenCalledWith(
      "https://optizzz.fr/api/s5/players/42/analysis",
      expect.objectContaining({ credentials: "omit" }),
    );
  });

  it("is null when the site does not answer, or not with an analysis", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("offline"))),
    );
    expect(await loadPlayerAnalysis("https://s5.fourmizzz.fr", 42)).toBeNull();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(Response.json({ days: "many" }))),
    );
    expect(await loadPlayerAnalysis("https://s5.fourmizzz.fr", 42)).toBeNull();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(null, { status: 503 }))),
    );
    expect(await loadPlayerAnalysis("https://s5.fourmizzz.fr", 42)).toBeNull();
  });
});

describe("loadAllianceFloods", () => {
  it("reads an alliance's floods by other alliance", async () => {
    const floods = {
      rows: [{ opponent: "4O4", kind: "alliance", taken: 1, lost: 2, count: 2 }],
      unknown: { taken: 0, lost: 0, count: 0 },
      inside: { amount: 0, count: 0 },
    };
    const fetch = vi.fn(() => Promise.resolve(Response.json(floods)));
    vi.stubGlobal("fetch", fetch);
    expect(await loadAllianceFloods("https://s5.fourmizzz.fr", "-AP-")).toEqual(floods);
    expect(fetch).toHaveBeenCalledWith(
      "https://optizzz.fr/api/s5/alliances/-AP-/floods",
      expect.objectContaining({ credentials: "omit" }),
    );
  });
});
