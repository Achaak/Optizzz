import { describe, expect, it, vi } from "vitest";
import { reineWithQueue } from "./__fixtures__/reine";
import { launchLayings, type LaunchStatus } from "./launch";

const ORIGIN = "https://s5.fourmizzz.fr";
const noWait = () => Promise.resolve();

/** Reine.php that queues what is posted to it, unless `refuse` says otherwise. */
function fakeGame(queue: [string, string][] = [], refuse: (post: URLSearchParams) => boolean = () => false) {
  const posts: URLSearchParams[] = [];
  const names: Record<string, string> = { ouvriere: "ouvrières", unite1: "Jeunes Soldates Naines" };
  const places: Record<string, string> = { "1": "Terrain de Chasse", "2": "Fourmilière", "3": "Loge Impériale" };
  const fetchFn = vi.fn((url: string, init?: RequestInit) => {
    expect(url).toBe(`${ORIGIN}/Reine.php`);
    if (init?.method === "POST") {
      const post = new URLSearchParams(init.body as string);
      posts.push(post);
      if (!refuse(post)) {
        const type = post.get("typeUnite") ?? "";
        queue.push([
          `${post.get("nombre_de_ponte") ?? ""} ${names[type] ?? ""}`,
          places[post.get("destination") ?? "2"] ?? "",
        ]);
      }
    }
    return Promise.resolve(new Response(reineWithQueue(...queue)));
  });
  return { fetchFn, posts, queue };
}

describe("launchLayings", () => {
  it("posts each laying with a fresh token, its count and its destination, in order", async () => {
    const game = fakeGame([["6 Jeunes Soldates Naines", "Loge Impériale"]]);
    const statuses: LaunchStatus[][] = [];
    const result = await launchLayings(
      ORIGIN,
      [
        { unit: "JSN", count: 100, destination: "field" },
        { unit: "worker", count: 2000, destination: "lodge" },
      ],
      { fetchFn: game.fetchFn, wait: noWait, onStatus: (all) => statuses.push([...all]) },
    );
    expect(result).toEqual(["launched", "launched"]);
    expect(game.fetchFn).toHaveBeenCalledTimes(4);
    expect(Object.fromEntries(game.posts[0] ?? [])).toEqual({
      unePonte: "oui",
      typeUnite: "unite1",
      t: "TOKEN",
      input_cout_nombre1: "100",
      nombre_de_ponte: "100",
      destination: "1",
    });
    expect(Object.fromEntries(game.posts[1] ?? [])).toEqual({
      unePonte: "oui",
      typeUnite: "ouvriere",
      t: "TOKEN",
      input_cout_nombre: "2000",
      nombre_de_ponte: "2000",
    });
    expect(statuses[0]).toEqual(["launching", "pending"]);
  });

  it("stops at the first laying the game did not queue", async () => {
    const game = fakeGame([], (post) => post.get("nombre_de_ponte") === "100");
    const result = await launchLayings(
      ORIGIN,
      [
        { unit: "JSN", count: 10, destination: "lodge" },
        { unit: "JSN", count: 100, destination: "lodge" },
        { unit: "JSN", count: 5, destination: "lodge" },
      ],
      { fetchFn: game.fetchFn, wait: noWait },
    );
    expect(result).toEqual(["launched", "failed", "pending"]);
    expect(game.posts).toHaveLength(2);
  });

  it("fails without posting a unit the page cannot lay", async () => {
    const game = fakeGame();
    const result = await launchLayings(ORIGIN, [{ unit: "SN", count: 10, destination: "lodge" }], {
      fetchFn: game.fetchFn,
      wait: noWait,
    });
    expect(result).toEqual(["failed"]);
    expect(game.posts).toHaveLength(0);
  });
});
