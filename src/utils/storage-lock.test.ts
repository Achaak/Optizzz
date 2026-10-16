import { afterEach, describe, expect, it, vi } from "vitest";
import { withStorageLock } from "./storage-lock";

afterEach(() => vi.restoreAllMocks());

describe("withStorageLock", () => {
  it("runs tasks with the same name one after the other", async () => {
    let release: () => void = vi.fn();
    const gate = new Promise<void>((resolve) => (release = resolve));
    const started: string[] = [];
    const first = withStorageLock("k", async () => {
      started.push("first");
      await gate;
    });
    const second = withStorageLock("k", () => {
      started.push("second");
      return Promise.resolve();
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(started).toEqual(["first"]);
    release();
    await Promise.all([first, second]);
    expect(started).toEqual(["first", "second"]);
  });

  it("runs the next task after one that fails", async () => {
    const first = withStorageLock("k", () => Promise.reject(new Error("boom")));
    const second = withStorageLock("k", () => Promise.resolve("ok"));
    await expect(first).rejects.toThrow("boom");
    await expect(second).resolves.toBe("ok");
  });

  it("uses navigator.locks when the browser has it", async () => {
    const request = vi.fn((_name: string, task: () => Promise<unknown>) => task());
    vi.spyOn(navigator, "locks", "get").mockReturnValue({ request } as never);
    await expect(withStorageLock("k", () => Promise.resolve(42))).resolves.toBe(42);
    expect(request).toHaveBeenCalledWith("optizzz:k", expect.any(Function));
  });
});
