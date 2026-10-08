import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import noSessionHtml from "@/features/end-times/__fixtures__/page-without-session.html?raw";
import reineHtml from "@/features/end-times/__fixtures__/reine-laying.html?raw";
import ressourcesHtml from "@/features/end-times/__fixtures__/ressources-hunts.html?raw";
import { loadSections, refreshSections, storeSection } from "@/data/end-times";

const ORIGIN = "https://s5.fourmizzz.fr";
const now = new Date(2026, 9, 7, 12, 50, 0);

const fakeGame = (pages: Record<string, string>) =>
  vi.fn((url: string) => {
    const html = pages[url.replace(ORIGIN, "")];
    return Promise.resolve(html === undefined ? new Response("", { status: 404 }) : new Response(html));
  });

describe("end-time sections", () => {
  beforeEach(() => fakeBrowser.reset());
  afterEach(() => vi.unstubAllGlobals());

  it("keeps sections per server, dates included", async () => {
    const section = { kind: "hunt" as const, readAt: now, items: [{ label: "Chasse 1 cm²", endsAt: now }] };
    await storeSection(ORIGIN, section);
    expect(await loadSections(ORIGIN)).toEqual({ hunt: section });
    expect(await loadSections("https://s1.fourmizzz.fr")).toEqual({});
  });

  it("reads the asked pages again and keeps what they list", async () => {
    vi.stubGlobal("fetch", fakeGame({ "/Ressources.php": ressourcesHtml, "/Reine.php": reineHtml }));
    // Each section is dated when its page answered.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(now);
    const sections = await refreshSections(ORIGIN, ["hunt", "laying"]);
    vi.useRealTimers();
    expect(sections.hunt?.items).toHaveLength(2);
    expect(sections.laying?.items).toHaveLength(3);
    expect((await loadSections(ORIGIN)).laying?.readAt).toEqual(now);
  });

  it("keeps the old section when a page cannot be read", async () => {
    const old = { kind: "hunt" as const, readAt: new Date(2026, 9, 7, 10, 0, 0), items: [] };
    await storeSection(ORIGIN, old);
    vi.stubGlobal("fetch", fakeGame({ "/Ressources.php": noSessionHtml }));
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect((await refreshSections(ORIGIN, ["hunt", "research"])).hunt).toEqual(old);
  });
});
