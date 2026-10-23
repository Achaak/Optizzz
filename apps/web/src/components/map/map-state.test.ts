import { describe, expect, it } from "vitest";
import { decodeMapState, encodeMapState, requestedMap, type MapState } from "./map-state";

const state: MapState = {
  chips: [
    { kind: "alliance", tag: "ABC-é", color: "#0a5fa8", filter: { field: { min: 10_000, max: 30_000 } } },
    { kind: "player", id: 42, color: "#b88600" },
    { kind: "unaffiliated", color: "#2e2e2e" },
  ],
  reference: 42,
  level: 12,
};

const base64Url = (value: unknown) =>
  btoa(JSON.stringify(value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

describe("map state in the address", () => {
  it("gives back the chips, their colours and filters, the reference and the speed", () => {
    const text = encodeMapState(state);
    expect(text).toMatch(/^1\.[A-Za-z0-9_-]+$/);
    expect(decodeMapState(text)).toEqual(state);
  });

  it("refuses a state without its version, or of an unknown one", () => {
    const body = encodeMapState(state).slice("1.".length);
    expect(decodeMapState(body)).toBeNull();
    expect(decodeMapState(`2.${body}`)).toBeNull();
  });

  it("refuses what is not a state", () => {
    expect(decodeMapState("1.not-base64!")).toBeNull();
    expect(decodeMapState(encodeMapState(state).slice(0, 20))).toBeNull();
    expect(decodeMapState(`1.${base64Url({ c: [{ p: 1, k: "red" }], r: null, v: 0 })}`)).toBeNull();
  });
});

describe("what the map address asks for", () => {
  const at = (address: string) => requestedMap(new URL(address, "https://optizzz.fr"));

  it("reads a shared state from the fragment", () => {
    expect(at(`/s5/map#p=${encodeMapState(state)}`)).toEqual({ kind: "state", state });
  });

  it("says a broken shared link is not valid", () => {
    expect(at("/s5/map#p=1.abc")).toEqual({ kind: "invalid" });
    expect(at(`/s5/map#p=${encodeMapState(state).replace("1.", "9.")}`)).toEqual({ kind: "invalid" });
  });

  it("does not read the old `?p=` links", () => {
    expect(at(`/s5/map?p=${encodeMapState(state)}`)).toEqual({ kind: "none" });
  });

  it("reads « Voir sur la carte » for a player or an alliance", () => {
    expect(at("/s5/map?player=42")).toEqual({ kind: "target", target: { kind: "player", id: 42 } });
    expect(at("/s5/map?alliance=L%2FN")).toEqual({ kind: "target", target: { kind: "alliance", tag: "L/N" } });
    expect(at("/s5/map?player=abc")).toEqual({ kind: "none" });
    expect(at("/s5/map?joueur=42")).toEqual({ kind: "none" });
  });

  it("prefers the fragment over a target", () => {
    expect(at(`/s5/map?player=1#p=${encodeMapState(state)}`)).toEqual({ kind: "state", state });
  });
});
