import { describe, expect, it, vi } from "vitest";
import { health } from "./health";

describe("health", () => {
  it("answers 200 when every read works", async () => {
    const response = await health([() => Promise.resolve(1), () => Promise.resolve(null)]);
    expect(response.status).toBe(200);
  });

  it("answers 503, without details, when a read fails", async () => {
    // The failure is logged on purpose: kept out of the test's output.
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await health([() => Promise.reject(new Error("password authentication failed"))]);
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("password");
    vi.restoreAllMocks();
  });
});
