import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import type { Alliance, Player } from "@optizzz/game/exports";
import { readServerMapSettings, rememberPlayer } from "./settings";
import { ServerMap } from "./ServerMap";

// Smoke test of the page: chips at opening, the table, the camps. The map itself is checked by hand.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ORIGIN = "https://s5.fourmizzz.fr";

const player = (id: number, pseudo: string, alliance: string | null, x: number, y: number): Player => ({
  id,
  pseudo,
  alliance,
  masterPlayerId: null,
  x,
  y,
  field: 1000 * id,
  grade: null,
  buildingScore: 0,
  technologyScore: 0,
  trophyScore: 0,
  onHoliday: false,
  isBanned: false,
});

const alliance = (tag: string, wars: string[] = []): Alliance => ({
  tag,
  name: tag,
  playersCount: 2,
  totalField: 0,
  totalBuildingScore: 0,
  totalTechnologyScore: 0,
  totalTrophyScore: 0,
  diplomacy: { pacts: [], wars },
});

vi.mock("@/data/exports", () => ({
  loadPlayersExport: () =>
    Promise.resolve({
      version: "202610160800",
      players: [
        player(1, "Moi", "MOI", 10, 10),
        player(2, "Amie", "MOI", 13, 14),
        player(3, "Rival", "EVO", 40, 50),
        player(4, "Rivale", "EVO", 44, 52),
        player(5, "Libre", null, 80, 80),
      ],
    }),
  loadAlliancesExport: () =>
    Promise.resolve({ version: "202610160800", alliances: [alliance("MOI"), alliance("EVO", ["moi"])] }),
}));

const siteMap = vi.hoisted(() => ({ load: vi.fn<() => Promise<unknown>>(() => Promise.resolve(null)) }));
vi.mock("@/data/site-map", () => ({ loadSiteMap: siteMap.load }));

let container: HTMLElement;

beforeEach(async () => {
  fakeBrowser.reset();
  container = document.createElement("div");
  document.body.append(container);
  await rememberPlayer(ORIGIN, "Moi");
});

afterEach(() => {
  container.remove();
});

async function render(target: Parameters<typeof ServerMap>[0]["target"] = null, siteAllowed = false) {
  const root = createRoot(container);
  await act(async () => {
    root.render(<ServerMap origin={ORIGIN} target={target} embedded sharing={false} siteAllowed={siteAllowed} />);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return root;
}

/** Each chip's name and filter, without its buttons. */
const chips = () =>
  [...container.querySelectorAll(".chip")].map((chip) => {
    const copy = chip.cloneNode(true) as HTMLElement;
    copy.querySelectorAll("button").forEach((button) => button.remove());
    return copy.textContent.trim();
  });

const buttonNamed = (text: string) =>
  [...container.querySelectorAll("button")].find((button) => button.textContent.startsWith(text));

/** Types in a React field as the player would, then Enter. */
function typeIn(input: HTMLInputElement, text: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, text);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
}
const tablePseudos = () =>
  [...container.querySelectorAll(".player-table tbody tr")].map((row) => row.querySelector("button")?.textContent);

describe("ServerMap", () => {
  it("opens on my alliance, its members listed from me", async () => {
    await render();
    expect(chips()).toEqual(["MOI"]);
    expect(tablePseudos()).toEqual(["Amie"]);
    expect(container.textContent).toContain("trajets depuis Moi");
  });

  it("adds the alliances at war with mine in one click", async () => {
    await render();
    await act(async () => {
      buttonNamed("+ Mes guerres")?.click();
      await Promise.resolve();
    });
    expect(chips()).toEqual(["MOI", "EVO"]);
    expect(tablePseudos()).toEqual(["Amie", "Rival", "Rivale"]);
  });

  it("keeps in colour only the members of an alliance within its filter", async () => {
    await render();
    await act(async () => {
      buttonNamed("+ Mes guerres")?.click();
      await Promise.resolve();
    });
    const evo = [...container.querySelectorAll(".chip")].find((chip) => chip.textContent.startsWith("EVO"));
    await act(async () => {
      evo?.querySelector<HTMLButtonElement>(".filter-toggle")?.click();
      await Promise.resolve();
    });
    const min = container.querySelector<HTMLInputElement>('.chip-filter input[aria-label="TDC minimum"]');
    if (!min) throw new Error("no TDC field");
    await act(async () => {
      typeIn(min, "3500");
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(chips()).toEqual(["MOI", "EVOTDC ≥ 3 500"]);
    expect(tablePseudos()).toEqual(["Amie", "Rivale"]);
    expect(container.querySelector(".chip-filter")?.textContent).toContain("1 joueur sur 2");
  });

  it("opened on a player, shows my alliance and that player", async () => {
    await render({ kind: "player", id: 5 });
    expect(chips()).toEqual(["MOI", "Libre"]);
  });

  it("hides my marker on demand, and remembers it", async () => {
    await render();
    const box = container.querySelector<HTMLInputElement>(".show-me input");
    expect(box?.checked).toBe(true);
    await act(async () => {
      box?.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(container.querySelector<HTMLInputElement>(".show-me input")?.checked).toBe(false);
    expect((await readServerMapSettings("s5.fourmizzz.fr")).showMe).toBe(false);
  });

  it("writes every name on demand, and remembers it", async () => {
    await render();
    const box = container.querySelector<HTMLInputElement>(".all-names input");
    expect(box?.checked).toBe(false);
    await act(async () => {
      box?.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect((await readServerMapSettings("s5.fourmizzz.fr")).allNames).toBe(true);
  });

  it("reads the positions on the site when allowed, and says so", async () => {
    siteMap.load.mockResolvedValueOnce({
      players: {
        version: "202610221400",
        players: [player(1, "Moi", "MOI", 10, 10), player(6, "Site", "MOI", 12, 12)],
      },
      alliances: { version: "202610221400", alliances: [alliance("MOI")] },
    });
    await render(null, true);
    expect(container.textContent).toContain("(via optizzz.fr)");
    expect(container.textContent).toContain("Site");
  });

  it("falls back on the export when the site does not answer", async () => {
    siteMap.load.mockResolvedValueOnce(null);
    await render(null, true);
    expect(container.textContent).not.toContain("via optizzz.fr");
    expect(container.textContent).toContain("Amie");
  });
});
