import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import commerceHtml from "@/features/convoy/__fixtures__/commerce.html?raw";
import { forgetGamePages } from "@/utils/game-page";
import {
  CONVOYS_MAX_AGE,
  convoysOutdated,
  loadConvoys,
  readKeptConvoys,
  refreshConvoys,
  storeConvoys,
} from "./convoys";

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
  it("reads the convoys I send on a logged-in commerce.php, not those I receive, none on any other game page", () => {
    expect(readKeptConvoys(parse(commerceHtml), now)?.map((convoy) => convoy.recipient)).toEqual([
      "Messor",
      "Tetramorium",
    ]);
    expect(readKeptConvoys(parse("<div id='data'></div>"), now)).toEqual([]);
    expect(readKeptConvoys(parse("<p>Connexion</p>"), now)).toBeNull();
  });
});

describe("convoys storage", () => {
  it("keeps the convoys per server, with when they were read", async () => {
    const convoys = [{ recipient: "Tetramorium", food: 0, materials: 12_500, arrivesAt: new Date(2026, 9, 8, 1, 0) }];
    await storeConvoys(ORIGIN, convoys, now);
    expect(await loadConvoys(ORIGIN)).toEqual({ readAt: now, convoys });
    expect(await loadConvoys("https://s1.fourmizzz.fr")).toBeNull();
    await storeConvoys(ORIGIN, convoys, now, 4_995);
    expect(await loadConvoys(ORIGIN)).toEqual({ readAt: now, convoys, workers: 4_995 });
  });

  it("reads commerce.php again, and keeps the old list when the game does not answer", async () => {
    vi.useFakeTimers({ now, toFake: ["Date"] });
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(commerceHtml))),
    );
    const read = await refreshConvoys(ORIGIN);
    expect(read?.convoys.map((convoy) => convoy.food + convoy.materials)).toEqual([1, 12_500]);
    expect(read?.workers).toBe(4_995);

    forgetGamePages();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response("", { status: 503 }))),
    );
    expect((await refreshConvoys(ORIGIN))?.convoys).toHaveLength(2);
  });
});

describe("convoysOutdated", () => {
  const kept = { readAt: now, convoys: [], workers: 5_000 };
  const later = (ms: number) => new Date(now.getTime() + ms);

  it("reads commerce.php again when nothing is kept or the list is too old", () => {
    expect(convoysOutdated(null, 5_000, now)).toBe(true);
    expect(convoysOutdated(kept, 5_000, later(CONVOYS_MAX_AGE))).toBe(false);
    expect(convoysOutdated(kept, 5_000, later(CONVOYS_MAX_AGE + 1))).toBe(true);
  });

  it("reads it again as soon as the header's workers dropped: a convoy may have left from elsewhere", () => {
    expect(convoysOutdated(kept, 4_999, later(60_000))).toBe(true);
    expect(convoysOutdated(kept, 5_200, later(60_000))).toBe(false);
    expect(convoysOutdated({ readAt: now, convoys: [] }, 1, later(60_000))).toBe(false);
  });
});
