import { describe, expect, it, vi } from "vitest";
import { fetchGamePage } from "./game-page";

describe("fetchGamePage", () => {
  it("shares one request between features asking for the same page", async () => {
    const fetchFn = vi.fn(() => Promise.resolve(new Response("<p id='x'>1</p>")));
    const [a, b] = await Promise.all([
      fetchGamePage("/Ressources.php", fetchFn),
      fetchGamePage("/Ressources.php", fetchFn),
    ]);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(a?.getElementById("x")?.textContent).toBe("1");
    expect(b).toBe(a);
  });

  it("gives null for an error status", async () => {
    expect(await fetchGamePage("/Armee.php", () => Promise.resolve(new Response("", { status: 503 })))).toBeNull();
  });

  it("does not keep a failed request", async () => {
    await expect(fetchGamePage("/Reine.php", () => Promise.reject(new Error("offline")))).rejects.toThrow("offline");
    const fetchFn = vi.fn(() => Promise.resolve(new Response("<p>ok</p>")));
    await fetchGamePage("/Reine.php", fetchFn);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});
