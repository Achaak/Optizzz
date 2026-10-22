import { describe, expect, it } from "vitest";
import { decodeMapState, encodeMapState, type MapState } from "./map-state";

describe("map state in the address", () => {
  it("gives back the chips, their colours and filters, the reference and the speed", () => {
    const state: MapState = {
      chips: [
        { kind: "alliance", tag: "ABC-é", color: "#0a5fa8", filter: { field: { min: 10_000, max: 30_000 } } },
        { kind: "player", id: 42, color: "#b88600" },
        { kind: "unaffiliated", color: "#2e2e2e" },
      ],
      reference: 42,
      level: 12,
    };
    const text = encodeMapState(state);
    expect(text).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeMapState(text)).toEqual(state);
  });

  it("refuses what is not a state", () => {
    expect(decodeMapState("not-base64!")).toBeNull();
    expect(decodeMapState(btoa(JSON.stringify({ c: [{ p: 1, k: "red" }], r: null, v: 0 })))).toBeNull();
  });
});
