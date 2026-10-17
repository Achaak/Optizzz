import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { addToWatchlist } from "@/data/watchlist";
import { loadJournal, rememberServer, takeReading } from "./reading";

const ORIGIN = "http://s1.fourmizzz.fr";
const HOST = "s1.fourmizzz.fr";
const now = new Date(Date.UTC(2026, 9, 17, 12));

const player = (alliance: string | null, field: number) => ({
  id: 1,
  pseudo: "Rival",
  alliance,
  masterPlayerId: null,
  x: 0,
  y: 0,
  field,
  grade: null,
  buildingScore: 0,
  technologyScore: 0,
  trophyScore: 0,
  onHoliday: false,
  isBanned: false,
});

/** The API with one players export per version, latest first. */
function fakeApi(versions: Record<string, unknown[]>) {
  const list = Object.keys(versions).sort().reverse();
  return vi.fn((url: string) => {
    if (url === `${ORIGIN}/api/exports/`) return Promise.resolve(Response.json({ players: list, alliances: [] }));
    const version = /players\/\?version=(\d+)/.exec(url)?.[1] ?? "";
    return Promise.resolve(Response.json(versions[version] ?? []));
  });
}

describe("takeReading", () => {
  beforeEach(async () => {
    fakeBrowser.reset();
    await rememberServer(ORIGIN);
    await addToWatchlist(HOST, {
      kind: "player",
      id: 1,
      pseudo: "Rival",
      seen: { version: "202610170900", field: 1000 },
    });
  });

  it("notes nothing on the first reading, then the changes, once per export", async () => {
    vi.stubGlobal("fetch", fakeApi({ "202610171000": [player("ABC", 1000)] }));
    expect((await takeReading(HOST, now))?.fresh).toEqual([]);
    expect(await takeReading(HOST, now)).toBeNull();

    const fetch = fakeApi({ "202610171000": [], "202610171100": [player("XYZ", 600)] });
    vi.stubGlobal("fetch", fetch);
    const reading = await takeReading(HOST, now);
    expect(reading?.fresh.map((entry) => entry.change)).toEqual([{ kind: "alliance", from: "ABC", to: "XYZ" }]);
    expect(reading?.losses).toEqual([{ key: "player:1", name: "Rival", percent: 40 }]);
    expect(await loadJournal(HOST)).toEqual(reading?.fresh);
    // Over HTTP, as remembered: S1–S4 have no HTTPS.
    expect(fetch).toHaveBeenCalledWith(`${ORIGIN}/api/exports/players/?version=202610171100`);
  });

  it("reads nothing for an empty list", async () => {
    const fetch = fakeApi({});
    vi.stubGlobal("fetch", fetch);
    expect(await takeReading("s5.fourmizzz.fr", now)).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
});
