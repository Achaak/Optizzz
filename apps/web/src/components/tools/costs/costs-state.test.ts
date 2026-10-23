import { readLinkState } from "@optizzz/game/site-links/link-state";
import { describe, expect, it } from "vitest";
import { costsFormat, EMPTY_COSTS, MAX_LEVEL, type CostsState } from "./costs-state";

const state: CostsState = { element: "laying", from: 12, to: 20, architecture: 10, analysisRoom: 7 };

const address = (encoded: string) => new URL(`https://optizzz.fr/tools/costs#p=${encoded}`);

describe("costsFormat", () => {
  it("reads back what it writes, with the version first", () => {
    const encoded = costsFormat.encode(state);
    expect(encoded.startsWith("1.")).toBe(true);
    expect(costsFormat.decode(encoded)).toEqual(state);
  });

  it("keeps emptied fields", () => {
    const empty: CostsState = { element: "dome", from: null, to: null, architecture: null, analysisRoom: null };
    expect(costsFormat.decode(costsFormat.encode(empty))).toEqual(empty);
    expect(costsFormat.decode(costsFormat.encode(EMPTY_COSTS))).toEqual(EMPTY_COSTS);
  });

  it("keeps the link short", () => {
    expect(costsFormat.encode(state).length).toBeLessThan(100);
  });

  it("refuses an element the game does not have, a level out of range or another version", () => {
    const wrong = (wire: unknown, version = 1) => `${String(version)}.${btoa(JSON.stringify(wire)).replace(/=+$/, "")}`;
    expect(costsFormat.decode(wrong({ e: "castle", f: 0, t: 1, a: 0, s: 0 }))).toBeNull();
    expect(costsFormat.decode(wrong({ e: "dome", f: -1, t: 1, a: 0, s: 0 }))).toBeNull();
    expect(costsFormat.decode(wrong({ e: "dome", f: 0, t: MAX_LEVEL + 1, a: 0, s: 0 }))).toBeNull();
    expect(costsFormat.decode(wrong({ e: "dome", f: 0, t: 1.5, a: 0, s: 0 }))).toBeNull();
    expect(costsFormat.decode(wrong({ e: "dome", f: 0, t: 1, a: 0, s: 0 }, 2))).toBeNull();
    expect(readLinkState(address("1.abc"), costsFormat)).toEqual({ kind: "invalid" });
  });

  it("is read from the fragment of the tool's address", () => {
    expect(readLinkState(address(costsFormat.encode(state)), costsFormat)).toEqual({ kind: "state", state });
  });
});
