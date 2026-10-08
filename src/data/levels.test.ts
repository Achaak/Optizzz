import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import constructionHtml from "@/features/game-levels/__fixtures__/construction.html?raw";
import laboratoryHtml from "@/features/game-levels/__fixtures__/laboratory.html?raw";
import { loadLevels, loadLevelsOf, readLevels, storeLevels, UnknownLevelsError } from "@/data/levels";
import { forgetGamePages } from "@/utils/game-page";

const parse = (html: string) => new DOMParser().parseFromString(html, "text/html");
const origin = "https://s5.fourmizzz.fr";

describe("readLevels", () => {
  it("reads the research levels on laboratoire.php", () => {
    expect(readLevels(parse(laboratoryHtml))).toEqual({ shield: 4, weapons: 4, huntSpeed: 3, attackSpeed: 0 });
  });

  it("reads the dome, lodge, aphid and cochineal farms on construction.php", () => {
    expect(readLevels(parse(constructionHtml))).toEqual({ dome: 3, lodge: 1, aphids: 4, cochineal: 2 });
  });

  it("recognizes a row title with or without accents", () => {
    const row = (title: string) =>
      `<div class="ligneAmelioration"><h2>${title}</h2><span class="niveau_amelioration">niveau 5</span></div>`;
    expect(readLevels(parse(row("Étable à pucerons") + row("Dome")))).toEqual({ aphids: 5, dome: 5 });
  });
});

describe("loadLevels", () => {
  beforeEach(() => fakeBrowser.reset());

  const fakeGame = () =>
    vi.fn((url: string) =>
      Promise.resolve(new Response(url.endsWith("/laboratoire.php") ? laboratoryHtml : constructionHtml)),
    );

  it("uses the levels stored when the player went by the pages", async () => {
    await storeLevels(origin, readLevels(parse(laboratoryHtml)), "laboratoire.php");
    await storeLevels(origin, readLevels(parse(constructionHtml)), "construction.php");
    const fetchFn = fakeGame();
    expect(await loadLevels(origin, fetchFn)).toEqual({ weapons: 4, shield: 4, huntSpeed: 3, cochineal: 2 });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("reads the missing pages once, and keeps what it read", async () => {
    await storeLevels(origin, readLevels(parse(laboratoryHtml)), "laboratoire.php");
    const fetchFn = fakeGame();
    expect(await loadLevels(origin, fetchFn)).toEqual({ weapons: 4, shield: 4, huntSpeed: 3, cochineal: 2 });
    expect(fetchFn).toHaveBeenCalledWith(`${origin}/construction.php`);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    await loadLevels(origin, fetchFn);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("keeps levels apart per server", async () => {
    const all = { weapons: 9, shield: 0, huntSpeed: 0, cochineal: 0 };
    for (const page of ["laboratoire.php", "construction.php"] as const) {
      await storeLevels(origin, all, page);
      await storeLevels("https://s1.fourmizzz.fr", { ...all, weapons: 1 }, page);
    }
    expect((await loadLevels(origin, fakeGame())).weapons).toBe(9);
  });

  it("reads only the page of the levels asked for", async () => {
    await storeLevels(origin, readLevels(parse(laboratoryHtml)), "laboratoire.php");
    const fetchFn = fakeGame();
    expect(await loadLevelsOf(origin, ["attackSpeed"], fetchFn)).toEqual({ attackSpeed: 0 });
    expect(fetchFn).not.toHaveBeenCalled();
    expect(await loadLevelsOf(origin, ["attackSpeed", "aphids"], fetchFn)).toEqual({ attackSpeed: 0, aphids: 4 });
    expect(fetchFn).toHaveBeenCalledWith(`${origin}/construction.php`);
  });

  it("reads a page again once its levels are more than 12 hours old, and keeps them if it fails", async () => {
    const now = new Date(2026, 9, 8, 12, 0);
    await storeLevels(origin, { attackSpeed: 2 }, "laboratoire.php", new Date(now.getTime() - 13 * 3_600_000));
    const fetchFn = fakeGame();
    expect(await loadLevelsOf(origin, ["attackSpeed"], fetchFn, now)).toEqual({ attackSpeed: 0 });
    expect(fetchFn).toHaveBeenCalledWith(`${origin}/laboratoire.php`);

    forgetGamePages();
    await storeLevels(origin, { attackSpeed: 2 }, "laboratoire.php", new Date(now.getTime() - 13 * 3_600_000));
    const down = () => Promise.resolve(new Response("", { status: 503 }));
    expect(await loadLevelsOf(origin, ["attackSpeed"], down, now)).toEqual({ attackSpeed: 2 });
  });

  it("says when a level cannot be read instead of guessing 0", async () => {
    const error = await loadLevelsOf(origin, ["attackSpeed"], () =>
      Promise.resolve(new Response("<p>Session expirée</p>")),
    ).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UnknownLevelsError);
    expect((error as UnknownLevelsError).pages).toEqual(["laboratoire.php"]);
  });

  it("does not read a page that answered with an error", async () => {
    await expect(
      loadLevelsOf(origin, ["aphids"], () => Promise.resolve(new Response(constructionHtml, { status: 503 }))),
    ).rejects.toBeInstanceOf(UnknownLevelsError);
  });

  it("shares one request between features asking at the same time", async () => {
    const fetchFn = fakeGame();
    await Promise.all([loadLevelsOf(origin, ["attackSpeed"], fetchFn), loadLevelsOf(origin, ["weapons"], fetchFn)]);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});
