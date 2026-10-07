import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import constructionHtml from "./__fixtures__/construction.html?raw";
import laboratoryHtml from "./__fixtures__/laboratory.html?raw";
import { loadLevels, readLevels, storeLevels } from "./levels";

const parse = (html: string) => new DOMParser().parseFromString(html, "text/html");
const origin = "https://s5.fourmizzz.fr";

describe("readLevels", () => {
  it("reads the research levels on laboratoire.php", () => {
    expect(readLevels(parse(laboratoryHtml))).toEqual({ shield: 4, weapons: 4, huntSpeed: 3, attackSpeed: 0 });
  });

  it("reads the cochineal farm on construction.php", () => {
    expect(readLevels(parse(constructionHtml))).toEqual({ cochineal: 2 });
  });
});

describe("loadLevels", () => {
  beforeEach(() => fakeBrowser.reset());

  const fakeGame = () =>
    vi.fn((url: string) =>
      Promise.resolve(new Response(url.endsWith("/laboratoire.php") ? laboratoryHtml : constructionHtml)),
    );

  it("uses the levels stored when the player went by the pages", async () => {
    await storeLevels(origin, readLevels(parse(laboratoryHtml)));
    await storeLevels(origin, readLevels(parse(constructionHtml)));
    const fetchFn = fakeGame();
    expect(await loadLevels(origin, fetchFn)).toEqual({ weapons: 4, shield: 4, huntSpeed: 3, cochineal: 2 });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("reads the missing pages once, and keeps what it read", async () => {
    await storeLevels(origin, readLevels(parse(laboratoryHtml)));
    const fetchFn = fakeGame();
    expect(await loadLevels(origin, fetchFn)).toEqual({ weapons: 4, shield: 4, huntSpeed: 3, cochineal: 2 });
    expect(fetchFn).toHaveBeenCalledWith(`${origin}/construction.php`);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    await loadLevels(origin, fetchFn);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("keeps levels apart per server", async () => {
    const all = { weapons: 9, shield: 0, huntSpeed: 0, cochineal: 0 };
    await storeLevels(origin, all);
    await storeLevels("https://s1.fourmizzz.fr", { ...all, weapons: 1 });
    expect((await loadLevels(origin, fakeGame())).weapons).toBe(9);
  });
});
