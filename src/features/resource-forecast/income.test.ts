import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import ressourcesHtml from "./__fixtures__/ressources.html?raw";
import { INCOME_MAX_AGE, loadIncome } from "./income";

const ORIGIN = "https://s5.fourmizzz.fr";
const MINUTE = 60_000;
const now = new Date(2026, 9, 7, 12, 7, 0);
const later = (minutes: number) => new Date(now.getTime() + minutes * MINUTE);

function fakeGame() {
  return vi.fn((url: string) =>
    Promise.resolve(
      url === `${ORIGIN}/Ressources.php`
        ? new Response(ressourcesHtml, { headers: { "Content-Type": "text/html" } })
        : new Response("", { status: 404 }),
    ),
  );
}

describe("loadIncome", () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it("reads Ressources.php in the background", async () => {
    vi.stubGlobal("fetch", fakeGame());
    const income = await loadIncome(ORIGIN, INCOME_MAX_AGE, now);
    expect(income).toMatchObject({ materialWorkers: 4004, armyPerDay: 1704 });
    expect(income?.nextHarvestAt).toEqual(new Date(now.getTime() + 977_000));
  });

  it("reuses what was read less than 15 minutes ago", async () => {
    const fetch = fakeGame();
    vi.stubGlobal("fetch", fetch);
    await loadIncome(ORIGIN, INCOME_MAX_AGE, now);
    const income = await loadIncome(ORIGIN, INCOME_MAX_AGE, later(10));
    expect(fetch).toHaveBeenCalledTimes(1);
    // Dates survive the storage round trip.
    expect(income?.nextHarvestAt).toEqual(new Date(now.getTime() + 977_000));
    expect(income?.hunts[0]?.returnsAt).toEqual(new Date(now.getTime() + 1_090_000));
  });

  it("reads again once the cache is too old, or when asked for fresh figures", async () => {
    const fetch = fakeGame();
    vi.stubGlobal("fetch", fetch);
    await loadIncome(ORIGIN, INCOME_MAX_AGE, now);
    await loadIncome(ORIGIN, INCOME_MAX_AGE, later(16));
    await loadIncome(ORIGIN, 0, later(17));
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("falls back on the last figures when the game cannot be reached", async () => {
    vi.stubGlobal("fetch", fakeGame());
    await loadIncome(ORIGIN, INCOME_MAX_AGE, now);
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("offline"))),
    );
    expect(await loadIncome(ORIGIN, 0, later(30))).toMatchObject({ materialWorkers: 4004 });
  });
});
