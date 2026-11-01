import { describe, expect, it } from "vitest";
import { chainRolesFrom, chainRolesText, type ChainRolesRecord } from "./chain-roles";

const SPACE = "space-4o4";

const record: ChainRolesRecord = {
  roles: {
    "101": { kind: "granary" },
    "102": { kind: "passer", rank: 2 },
    "103": { kind: "hunter" },
    "104": { kind: "out" },
  },
  keep: { "103": 1_500_000 },
};

const opened = (value: unknown) => chainRolesFrom(JSON.parse(JSON.stringify(value)), SPACE);

describe("chain roles record", () => {
  it("comes back as it was written, for the same space", () => {
    expect(chainRolesFrom(JSON.parse(chainRolesText(record, SPACE)), SPACE)).toEqual(record);
  });

  it("is refused in another space: the site cannot copy one space's roles into another", () => {
    expect(() => chainRolesFrom(JSON.parse(chainRolesText(record, SPACE)), "space-other")).toThrow();
  });

  it.each([
    ["an unknown role", { v: 1, spaceId: SPACE, roles: { "101": "queen" }, keep: {} }],
    ["passer 0", { v: 1, spaceId: SPACE, roles: { "101": "passer:0" }, keep: {} }],
    ["a negative field to keep", { v: 1, spaceId: SPACE, roles: {}, keep: { "101": -5 } }],
    ["a key that is no player id", { v: 1, spaceId: SPACE, roles: { Noctis: "granary" }, keep: {} }],
    ["a newer format", { v: 2, spaceId: SPACE, roles: {}, keep: {} }],
  ])("is refused with %s", (_, value) => {
    expect(() => opened(value)).toThrow();
  });
});
