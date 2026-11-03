import { readLinkState } from "@optizzz/game/site-links/link-state";
import { siteToolUrl } from "@optizzz/game/site-links/site";
import { describe, expect, it } from "vitest";
import {
  EMPTY_TRAVEL,
  MAX_ALLIANCES,
  swapEnds,
  travelFormat,
  withAlliance,
  withoutAlliance,
  withServer,
  type TravelState,
} from "./travel-state";

const full: TravelState = {
  server: "s5",
  from: { kind: "player", id: 1234 },
  to: { kind: "position", x: 35, y: 8 },
  attackSpeed: 3,
  departure: "2026-10-23T20:15",
  mode: "point",
  alliances: [],
};

const towardsAlliances: TravelState = { ...full, mode: "alliances", alliances: ["C6P", "-_-", "No-IA"] };

/** A link of the first version, before the alliances: `{ s, a, b, v, d }`. */
const firstVersionLink = (wire: object) =>
  `1.${btoa(JSON.stringify(wire)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;

describe("the travel tool's link", () => {
  it("gives back the same state, so a shared link gives the same calculation", () => {
    for (const state of [
      full,
      EMPTY_TRAVEL,
      towardsAlliances,
      { ...full, from: null, to: { kind: "position", x: 3, y: null } },
    ]) {
      const address = new URL(siteToolUrl("travel", travelFormat.encode(state as TravelState)));
      expect(readLinkState(address, travelFormat)).toEqual({ kind: "state", state });
    }
  });

  it("stays short", () => {
    expect(travelFormat.encode(full).length).toBeLessThan(140);
    const tenAlliances = { ...towardsAlliances, alliances: Array.from({ length: 10 }, (_, i) => `AB${String(i)}CD`) };
    expect(travelFormat.encode(tenAlliances).length).toBeLessThan(250);
  });

  it("still reads the links of the first version, towards a point", () => {
    const link = firstVersionLink({ s: "s5", a: 1234, b: [35, 8], v: 3, d: "2026-10-23T20:15" });
    expect(travelFormat.decode(link)).toEqual(full);
  });

  it("refuses more alliances than the tool takes", () => {
    const tooMany = {
      ...towardsAlliances,
      alliances: Array.from({ length: MAX_ALLIANCES + 1 }, (_, i) => `T${String(i)}`),
    };
    expect(travelFormat.decode(travelFormat.encode(tooMany))).toBeNull();
  });

  it("is refused when cut, hand-edited or of an unknown version", () => {
    const encoded = travelFormat.encode(full);
    expect(travelFormat.decode(encoded.slice(0, -6))).toBeNull();
    expect(travelFormat.decode(`3.${encoded.slice(2)}`)).toBeNull();
    const badTime = travelFormat.encode({ ...full, departure: "23/10 20 h 15" });
    expect(travelFormat.decode(badTime)).toBeNull();
    const negative = travelFormat.encode({ ...full, attackSpeed: -1 });
    expect(travelFormat.decode(negative)).toBeNull();
  });
});

describe("« Inverser »", () => {
  it("swaps the two ends and keeps the Attack Speed typed", () => {
    expect(swapEnds(full)).toEqual({ ...full, from: full.to, to: full.from });
    expect(swapEnds(swapEnds(full))).toEqual(full);
  });
});

describe("changing the server", () => {
  it("forgets the players of the other server and keeps the positions", () => {
    expect(withServer(full, "s2")).toEqual({ ...full, server: "s2", from: null });
    expect(withServer(full, null)).toEqual({ ...full, server: null, from: null });
  });

  it("forgets the alliances of the other server", () => {
    expect(withServer(towardsAlliances, "s2")).toEqual({
      ...towardsAlliances,
      server: "s2",
      from: null,
      alliances: [],
    });
  });

  it("changes nothing when it is the same server", () => {
    expect(withServer(full, "s5")).toBe(full);
  });
});

describe("the alliances chosen", () => {
  it("are added once each, in the order chosen, up to ten", () => {
    let state: TravelState = { ...towardsAlliances, alliances: [] };
    state = withAlliance(withAlliance(withAlliance(state, "C6P"), "NOX"), "C6P");
    expect(state.alliances).toEqual(["C6P", "NOX"]);
    for (let i = 0; i < 20; i++) state = withAlliance(state, `T${String(i)}`);
    expect(state.alliances).toHaveLength(MAX_ALLIANCES);
  });

  it("are removed one by one", () => {
    expect(withoutAlliance(towardsAlliances, "-_-").alliances).toEqual(["C6P", "No-IA"]);
  });
});
