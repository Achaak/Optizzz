import { readLinkState } from "@optizzz/game/site-links/link-state";
import { siteToolUrl } from "@optizzz/game/site-links/site";
import { describe, expect, it } from "vitest";
import { EMPTY_TRAVEL, swapEnds, travelFormat, withServer, type TravelState } from "./travel-state";

const full: TravelState = {
  server: "s5",
  from: { kind: "player", id: 1234 },
  to: { kind: "position", x: 35, y: 8 },
  attackSpeed: 3,
  departure: "2026-10-23T20:15",
};

describe("the travel tool's link", () => {
  it("gives back the same state, so a shared link gives the same calculation", () => {
    for (const state of [full, EMPTY_TRAVEL, { ...full, from: null, to: { kind: "position", x: 3, y: null } }]) {
      const address = new URL(siteToolUrl("travel", travelFormat.encode(state as TravelState)));
      expect(readLinkState(address, travelFormat)).toEqual({ kind: "state", state });
    }
  });

  it("stays short", () => {
    expect(travelFormat.encode(full).length).toBeLessThan(120);
  });

  it("is refused when cut, hand-edited or of an unknown version", () => {
    const encoded = travelFormat.encode(full);
    expect(travelFormat.decode(encoded.slice(0, -6))).toBeNull();
    expect(travelFormat.decode(`2.${encoded.slice(2)}`)).toBeNull();
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

  it("changes nothing when it is the same server", () => {
    expect(withServer(full, "s5")).toBe(full);
  });
});
