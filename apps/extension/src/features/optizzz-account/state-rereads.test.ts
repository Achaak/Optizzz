import { beforeEach, describe, expect, it } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import coloniesHtml from "@optizzz/game/pages/__fixtures__/colonies.html?raw";
import ressourcesHtml from "@optizzz/game/pages/__fixtures__/ressources.html?raw";
import { keepStatePages, loadStatePages, type StatePart } from "@/data/state-pages";
import { forgetGamePages } from "@/utils/game-page";
import { rereadStatePages, STATE_PAGE_MAX_AGE } from "./state-rereads";

const S5 = "https://s5.fourmizzz.fr";
const NOW = new Date("2026-10-26T12:00:00Z");
const HEADER =
  '<div id="data"><span id="nb_nourriture">1</span><span id="nb_materiaux">2</span><span id="nb_ouvrieres">3</span><span id="quantite_tdc">4</span></div>';
const PRODUCTION = new Set<StatePart>(["stock", "ressources", "colonies"]);

let asked: string[];
const fetchFn = (url: string) => {
  asked.push(new URL(url).pathname);
  const html = url.endsWith("/colonies.php") ? `${HEADER}${coloniesHtml}` : ressourcesHtml;
  return Promise.resolve(new Response(html));
};

beforeEach(() => {
  fakeBrowser.reset();
  forgetGamePages();
  asked = [];
});

describe("rereadStatePages", () => {
  it("reads Ressources.php and colonies.php again when they were never read, or long ago", async () => {
    await rereadStatePages(S5, "/reine.php", PRODUCTION, NOW, fetchFn);
    expect(asked).toEqual(["/Ressources.php", "/colonies.php"]);
    const kept = await loadStatePages(S5);
    expect(kept.ressources?.readAt).toBe(NOW.getTime());
    expect(kept.colonies?.colonies).toHaveLength(1);
  });

  it("reads nothing kept less than 15 minutes ago, nor the page open, nor what no category needs", async () => {
    await keepStatePages(S5, {
      ressources: {
        readAt: NOW.getTime() - STATE_PAGE_MAX_AGE + 1000,
        foodWorkers: 0,
        materialWorkers: 0,
        mushroomPerDay: 0,
        taxRate: 0,
        hunts: [],
      },
    });
    await rereadStatePages(S5, "/colonies.php", PRODUCTION, NOW, fetchFn);
    await rereadStatePages(S5, "/reine.php", new Set(["armee", "construction"]), NOW, fetchFn);
    expect(asked).toEqual([]);
  });
});
