import { describe, expect, it } from "vitest";
import { floodsByAlliance } from "./alliance-floods";

const flood = (
  victimAlliance: string | null,
  alliance: string | null,
  amount: number,
  sureness: "sure" | "combination" | "candidates" | "unknown" = "sure",
) => ({ victimAlliance, alliance, amount, sureness });

describe("floodsByAlliance", () => {
  it("adds up what each other alliance took and lost, the costliest first, the floods inside apart", () => {
    const table = floodsByAlliance(
      [
        flood("AP", "4O4", 3000),
        flood("4o4", "AP", 1000),
        flood("AP", "BZZ", 500, "candidates"),
        flood("BZZ", "ap", 900),
        // Taken by players without alliance, surely; by nobody known.
        flood("AP", null, 200, "combination"),
        flood("AP", null, 400, "candidates"),
        // Inside the alliance: the TDC chain.
        flood("AP", "AP", 700),
        // Neither side is AP.
        flood("KISS", "4O4", 9999),
      ],
      "AP",
    );
    expect(table.rows).toEqual([
      { opponent: "4O4", kind: "alliance", taken: 1000, lost: 3000, count: 2 },
      { opponent: "sans alliance", kind: "none", taken: 0, lost: 200, count: 1 },
      { opponent: "BZZ", kind: "alliance", taken: 900, lost: 500, count: 2 },
    ]);
    expect(table.unknown).toEqual({ taken: 0, lost: 400, count: 1 });
    expect(table.inside).toEqual({ amount: 700, count: 1 });
  });
});
