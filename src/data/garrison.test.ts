import { beforeEach, describe, expect, it } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { armyFromKeys } from "@/game/army/units";
import armeeHtml from "@/features/combat-simulator/__fixtures__/armee.html?raw";
import { loadGarrison, readGarrison, storeGarrison, type Garrison } from "@/data/garrison";

const parse = (html: string) => new DOMParser().parseFromString(html, "text/html");

describe("readGarrison", () => {
  it("reads each place's army from the count ids, and the dome and lodge levels", () => {
    expect(readGarrison(parse(armeeHtml))).toEqual({
      armies: {
        field: armyFromKeys({ JSN: 1200 }),
        nest: armyFromKeys({ Tk: 40 }),
        lodge: armyFromKeys({ JSN: 19, TuE: 5 }),
      },
      dome: 3,
      lodge: 1,
      field: 4496,
    });
  });

  it("reads nothing outside Armee.php", () => {
    expect(readGarrison(parse("<div id='data'></div><p>Ailleurs</p>"))).toBeNull();
  });
});

describe("garrison storage", () => {
  beforeEach(() => fakeBrowser.reset());

  it("keeps the last garrison read per server, with when it was read", async () => {
    const garrison = readGarrison(parse(armeeHtml));
    if (!garrison) throw new Error("fixture");
    const readAt = new Date(2026, 9, 7, 18, 0);
    await storeGarrison("https://s5.fourmizzz.fr", garrison, readAt);
    expect(await loadGarrison("https://s5.fourmizzz.fr")).toEqual({ ...garrison, readAt, previous: null });
    expect(await loadGarrison("https://s1.fourmizzz.fr")).toBeNull();
  });

  it("keeps the last army seen when the garrison is read empty (army out hunting)", async () => {
    const origin = "https://s5.fourmizzz.fr";
    const full: Garrison = {
      armies: { field: armyFromKeys({ JSN: 900 }), nest: armyFromKeys({}), lodge: armyFromKeys({}) },
      dome: 0,
      lodge: 0,
      field: 4000,
    };
    const empty: Garrison = {
      ...full,
      armies: { field: armyFromKeys({}), nest: armyFromKeys({}), lodge: armyFromKeys({}) },
    };
    await storeGarrison(origin, full, new Date(2026, 9, 7, 12, 0));
    await storeGarrison(origin, empty, new Date(2026, 9, 7, 13, 0));
    await storeGarrison(origin, empty, new Date(2026, 9, 7, 14, 0));
    const loaded = await loadGarrison(origin);
    expect(loaded?.armies).toEqual(empty.armies);
    expect(loaded?.previous).toEqual({ armies: full.armies, readAt: new Date(2026, 9, 7, 12, 0) });
    await storeGarrison(origin, full, new Date(2026, 9, 7, 15, 0));
    expect((await loadGarrison(origin))?.previous).toBeNull();
  });
});
