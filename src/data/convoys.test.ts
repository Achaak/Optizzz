import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import commerceHtml from "@/features/convoy/__fixtures__/commerce.html?raw";
import { forgetGamePages } from "@/utils/game-page";
import { loadConvoys, readKeptConvoys, refreshConvoys, storeConvoys } from "./convoys";

const ORIGIN = "https://s5.fourmizzz.fr";
const now = new Date(2026, 9, 7, 20, 31, 45);
const parse = (html: string) => new DOMParser().parseFromString(html, "text/html");

beforeEach(() => {
  fakeBrowser.reset();
  forgetGamePages();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("readKeptConvoys", () => {
  it("reads the convoys of a logged-in commerce.php, none on any other game page", () => {
    expect(readKeptConvoys(parse(commerceHtml), now)?.map((convoy) => convoy.recipient)).toEqual([
      "Osirus_jack",
      "Hardware",
    ]);
    expect(readKeptConvoys(parse("<div id='data'></div>"), now)).toEqual([]);
    expect(readKeptConvoys(parse("<p>Connexion</p>"), now)).toBeNull();
  });
});

describe("convoys storage", () => {
  it("keeps the convoys per server, with when they were read", async () => {
    const convoys = [{ recipient: "Hardware", food: 0, materials: 12_500, arrivesAt: new Date(2026, 9, 8, 1, 0) }];
    await storeConvoys(ORIGIN, convoys, now);
    expect(await loadConvoys(ORIGIN)).toEqual({ readAt: now, convoys });
    expect(await loadConvoys("https://s1.fourmizzz.fr")).toBeNull();
  });

  it("reads commerce.php again, and keeps the old list when the game does not answer", async () => {
    vi.useFakeTimers({ now, toFake: ["Date"] });
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(commerceHtml))),
    );
    expect((await refreshConvoys(ORIGIN))?.convoys.map((convoy) => convoy.food + convoy.materials)).toEqual([
      1, 12_500,
    ]);

    forgetGamePages();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response("", { status: 503 }))),
    );
    expect((await refreshConvoys(ORIGIN))?.convoys).toHaveLength(2);
  });
});
