import { describe, expect, it } from "vitest";
import { decodeTarget, encodeTarget } from "./open";

describe("map target in an address", () => {
  it("round-trips players and alliances, and rejects the rest", () => {
    for (const target of [
      { kind: "player", id: 42 },
      { kind: "alliance", tag: "A:B" },
    ] as const)
      expect(decodeTarget(encodeTarget(target))).toEqual(target);
    expect(decodeTarget("player:x")).toBeNull();
    expect(decodeTarget("profile:3")).toBeNull();
    expect(decodeTarget(null)).toBeNull();
  });
});
