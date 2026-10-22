import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import reineHtml from "@/features/laying-planner/__fixtures__/reine-form.html?raw";
import { LAYING_MAX_AGE, loadLaying, readLaying, storeLaying } from "@/data/laying";
import { forgetGamePages } from "@/utils/game-page";
import { htmlElement } from "@/utils/html";

const parse = (html: string) => new DOMParser().parseFromString(html, "text/html");
const origin = "https://s5.fourmizzz.fr";
const now = new Date("2026-10-16T12:00:00Z");

describe("readLaying", () => {
  it("reads the speed in the page's script and the units with a laying form", () => {
    expect(readLaying(parse(reineHtml))).toEqual({ speed: expect.closeTo(1 / 6) as number, units: ["JSN"] });
  });

  it("leaves out the locked units: their form has no quantity field and a requirement is missing", () => {
    const locked = `<table><tr class="ligneAmelioration"><td class="desciption_amelioration"><h2>Tank</h2>
      <span class="verificationNonOK">Caserne niveau 23</span></td><td class="cout_amelioration">
      <form method="post" action="Reine.php"><input type="hidden" name="typeUnite" value="unite10" /></form></td></tr></table>`;
    const doc = parse(reineHtml);
    doc.body.append(htmlElement(doc, "table", locked));
    expect(readLaying(doc)?.units).toEqual(["JSN"]);
  });

  it("is null on another page", () => {
    expect(readLaying(parse("<p>Armée</p>"))).toBeNull();
  });
});

describe("loadLaying", () => {
  beforeEach(() => {
    fakeBrowser.reset();
    forgetGamePages();
  });
  const fakeGame = () => vi.fn(() => Promise.resolve(new Response(reineHtml)));

  it("uses what was kept on Reine.php, without a request", async () => {
    await storeLaying(origin, { speed: 0.05, units: ["JSN", "SN"] }, new Date(now.getTime() - 60_000));
    const fetchFn = fakeGame();
    expect(await loadLaying(origin, now, fetchFn)).toMatchObject({ speed: 0.05, units: ["JSN", "SN"] });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("reads Reine.php when nothing was kept or it is old, and keeps it", async () => {
    await storeLaying(origin, { speed: 0.05, units: ["JSN"] }, new Date(now.getTime() - LAYING_MAX_AGE - 1));
    const fetchFn = fakeGame();
    expect(await loadLaying(origin, now, fetchFn)).toEqual({
      speed: expect.closeTo(1 / 6) as number,
      units: ["JSN"],
      readAt: now,
    });
    expect(fetchFn).toHaveBeenCalledWith(`${origin}/Reine.php`);
    forgetGamePages();
    await loadLaying(origin, now, fetchFn);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("keeps the old laying when Reine.php cannot be read", async () => {
    const readAt = new Date(now.getTime() - LAYING_MAX_AGE - 1);
    await storeLaying(origin, { speed: 0.05, units: ["JSN"] }, readAt);
    const fetchFn = vi.fn(() => Promise.resolve(new Response("", { status: 500 })));
    expect(await loadLaying(origin, now, fetchFn)).toEqual({ speed: 0.05, units: ["JSN"], readAt });
  });

  it("is null when never known and unreadable", async () => {
    const fetchFn = vi.fn(() => Promise.reject(new Error("offline")));
    expect(await loadLaying(origin, now, fetchFn)).toBeNull();
  });
});
