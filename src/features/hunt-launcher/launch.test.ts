import { describe, expect, it, vi } from "vitest";
import huntFormHtml from "./__fixtures__/hunt-form.html?raw";
import { launchHunts, type LaunchStatus } from "./launch";

const LAUNCHED = "<div>La chasse est lancée.</div>";

function fakeGame(responses: string[]) {
  const posts: URLSearchParams[] = [];
  const fetchFn = vi.fn((url: string, init?: RequestInit) => {
    if (init?.method === "POST") {
      posts.push(new URLSearchParams(init.body as string));
      return Promise.resolve(new Response(responses.shift() ?? ""));
    }
    expect(url).toBe("https://s5.fourmizzz.fr/AcquerirTerrain.php");
    return Promise.resolve(new Response(huntFormHtml));
  });
  return { fetchFn, posts };
}

const noWait = () => Promise.resolve();

describe("launchHunts", () => {
  it("posts each hunt with a fresh token, its surface and its units", async () => {
    const game = fakeGame([LAUNCHED, LAUNCHED]);
    const statuses: LaunchStatus[][] = [];
    await launchHunts(
      "https://s5.fourmizzz.fr",
      [
        { amount: 136, army: { JSN: 1000, SN: 70 } },
        { amount: 140, army: { JSN: 1112, SN: 76, Tk: 5 } },
      ],
      { fetchFn: game.fetchFn, wait: noWait, onStatus: (all) => statuses.push([...all]) },
    );
    expect(game.fetchFn).toHaveBeenCalledTimes(4);
    const [first, second] = game.posts;
    expect(Object.fromEntries(first ?? [])).toEqual({
      t: "TOKEN",
      pseudoCible: "",
      AcquerirTerrain: "136",
      unite1: "1000",
      unite2: "70",
      unite10: "0",
      ChoixArmee: "Lancer la Chasse !",
    });
    expect(second?.get("unite10")).toBe("5");
    expect(statuses.at(-1)).toEqual(["launched", "launched"]);
  });

  it("stops at the first refused hunt", async () => {
    const game = fakeGame(["<div>Vous n'avez pas assez d'unités</div>", LAUNCHED]);
    const result = await launchHunts(
      "https://s5.fourmizzz.fr",
      [
        { amount: 136, army: { JSN: 10 } },
        { amount: 140, army: { JSN: 10 } },
      ],
      { fetchFn: game.fetchFn, wait: noWait },
    );
    expect(result).toEqual(["failed", "pending"]);
    expect(game.posts).toHaveLength(1);
  });

  it("refuses to send a unit the game does not offer", async () => {
    const game = fakeGame([LAUNCHED]);
    const result = await launchHunts("https://s5.fourmizzz.fr", [{ amount: 10, army: { Tu: 3 } }], {
      fetchFn: game.fetchFn,
      wait: noWait,
    });
    expect(result).toEqual(["failed"]);
    expect(game.posts).toHaveLength(0);
  });

  it("waits between two hunts", async () => {
    const game = fakeGame([LAUNCHED, LAUNCHED]);
    const wait = vi.fn(noWait);
    await launchHunts(
      "https://s5.fourmizzz.fr",
      [
        { amount: 1, army: { JSN: 1 } },
        { amount: 1, army: { JSN: 1 } },
      ],
      { fetchFn: game.fetchFn, wait },
    );
    expect(wait).toHaveBeenCalledTimes(1);
  });
});
