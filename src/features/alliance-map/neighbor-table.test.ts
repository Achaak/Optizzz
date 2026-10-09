import { describe, expect, it } from "vitest";
import { neighborRows, type KnownLevels } from "./neighbor-table";

const me = { id: 1, pseudo: "Me", x: 0, y: 0 };
const near = { id: 2, pseudo: "Near", x: 0, y: 10 };
const far = { id: 3, pseudo: "Far", x: 0, y: 20 };
const members = [me, near, far];

const levels = (overrides: Partial<KnownLevels> = {}): KnownLevels => ({
  myId: 1,
  labLevel: null,
  manualLevel: null,
  byPlayer: new Map(),
  ...overrides,
});

describe("neighborRows", () => {
  it("lists the other members by distance and flags the k nearest", () => {
    const rows = neighborRows(me, members, 1, levels());
    expect(rows.map((r) => [r.player.pseudo, r.distance, r.withinK])).toEqual([
      ["Near", 10, true],
      ["Far", 20, false],
    ]);
  });

  it("uses the selected player's level outbound and the member's level inbound", () => {
    // Reference values: distance 10 → 17948 s at level 0, 13084 s at level 3.
    const [row] = neighborRows(me, members, 1, levels({ labLevel: 3 }));
    expect(row?.outbound).toEqual({ seconds: 13084, level: 3, estimated: false });
    expect(row?.inbound).toEqual({ seconds: 13084, level: 3, estimated: true });
  });

  it("prefers a level entered for a player over the global level", () => {
    const [row] = neighborRows(me, members, 1, levels({ byPlayer: new Map([[2, 0]]), labLevel: 3 }));
    expect(row?.inbound).toEqual({ seconds: 17948, level: 0, estimated: false });
  });

  it("applies the manual global level to members without a known level", () => {
    const [row] = neighborRows(near, members, 1, levels({ labLevel: 5, manualLevel: 0 }));
    // Outbound from Near (unknown → manual global 0), inbound from Me (Laboratory, 5).
    expect(row?.player.pseudo).toBe("Me");
    expect(row?.outbound).toMatchObject({ level: 0, estimated: true });
    expect(row?.inbound).toMatchObject({ level: 5, estimated: false });
  });
});
