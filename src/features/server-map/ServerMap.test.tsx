import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import type { Alliance, Player } from "@/data/exports";
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

async function render(target: Parameters<typeof ServerMap>[0]["target"] = null) {
  const root = createRoot(container);
  await act(async () => {
    root.render(<ServerMap origin={ORIGIN} target={target} embedded sharing={false} />);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return root;
}

const chips = () => [...container.querySelectorAll(".chip")].map((chip) => chip.textContent.replace("×", "").trim());
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
    const wars = [...container.querySelectorAll("button")].find((b) => b.textContent.startsWith("+ Mes guerres"));
    await act(async () => {
      wars?.click();
      await Promise.resolve();
    });
    expect(chips()).toEqual(["MOI", "EVO"]);
    expect(tablePseudos()).toEqual(["Amie", "Rival", "Rivale"]);
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
});
