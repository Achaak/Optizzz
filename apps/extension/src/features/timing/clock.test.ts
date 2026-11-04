import { describe, expect, it } from "vitest";
import { measureServerClock } from "./clock";

/** A PC 3 s behind the server, 200 ms from it, with a clock moved by the requests and waits. */
function fakeGame() {
  let pc = Date.parse("2026-11-04T08:30:00.130Z");
  const requests: { url: string; method: string }[] = [];
  return {
    requests,
    now: () => pc,
    wait: (ms: number) => {
      pc += ms;
      return Promise.resolve();
    },
    fetch: (url: string, init?: RequestInit) => {
      requests.push({ url, method: init?.method ?? "GET" });
      pc += 100;
      const serverDate = new Date(Math.floor((pc + 3000) / 1000) * 1000).toUTCString();
      pc += 100;
      return Promise.resolve(new Response(null, { headers: { date: serverDate } }));
    },
  };
}

describe("measureServerClock", () => {
  it("finds the server 3 s ahead with a few HEAD requests on Armee.php", async () => {
    const game = fakeGame();
    const clock = await measureServerClock(game);
    expect(clock?.offsetMs).toBeGreaterThan(2_800);
    expect(clock?.offsetMs).toBeLessThan(3_200);
    expect(clock?.oneWayMs).toBe(100);
    expect(game.requests).toEqual(Array.from({ length: 5 }, () => ({ url: "/Armee.php", method: "HEAD" })));
  });

  it("is null when the game gives no Date header", async () => {
    const game = fakeGame();
    const clock = await measureServerClock({ ...game, fetch: () => Promise.resolve(new Response(null)) });
    expect(clock).toBeNull();
  });
});
