import { createAllianceKeyring, rotateAllianceKey } from "@optizzz/crypto/alliance-key";
import { describe, expect, it } from "vitest";
import {
  changedMembers,
  lockChainRoles,
  openChainRoles,
  rebaseRoles,
  shownRoles,
  staleChainRoles,
} from "./chain-roles";

const SPACE = "space-4o4";

describe("chain roles on the site", () => {
  it("are encrypted with the newest version of the Clé d'alliance and open only in their space", async () => {
    const keyring = await rotateAllianceKey(await createAllianceKeyring());
    const record = { roles: { "101": { kind: "granary" as const } }, keep: { "103": 1_500_000 } };
    const blob = await lockChainRoles(record, SPACE, keyring);

    expect(await openChainRoles(blob, SPACE, keyring)).toEqual(record);
    expect(staleChainRoles(blob, 2)).toBe(false);
    expect(staleChainRoles(blob, 3)).toBe(true);
    await expect(openChainRoles(blob, "space-other", keyring)).rejects.toThrow();
    await expect(openChainRoles(blob, SPACE, await createAllianceKeyring())).rejects.toThrow();
  });
});

const member = (id: number, pseudo: string, field: number, more: { onHoliday?: boolean; isBanned?: boolean } = {}) => ({
  id,
  pseudo,
  field,
  onHoliday: more.onHoliday ?? false,
  isBanned: more.isBanned ?? false,
});

const roster = [
  member(1, "Noctis", 18_000_000),
  member(2, "Okapi", 9_000_000),
  member(3, "Zeph", 4_400_000),
  member(4, "Formica", 30_000_000, { onHoliday: true }),
];

describe("shownRoles", () => {
  it("proposes roles from the export's fields while none are saved, holidays out of the chain", () => {
    const shown = shownRoles(roster, null);

    expect(Object.fromEntries(shown.roles)).toEqual({
      1: { kind: "granary" },
      2: { kind: "passer", rank: 1 },
      3: { kind: "hunter" },
      4: { kind: "out" },
    });
    expect(shown.newcomers).toEqual([]);
  });

  it("shows the saved roles; a member arrived since is out and named, a banned one stays out", () => {
    const saved = { roles: { "1": { kind: "granary" as const }, "3": { kind: "hunter" as const } }, keep: {} };
    const shown = shownRoles([...roster, member(5, "Atta", 1_000_000, { isBanned: true })], saved);

    expect(Object.fromEntries(shown.roles)).toEqual({
      1: { kind: "granary" },
      2: { kind: "out" },
      3: { kind: "hunter" },
      4: { kind: "out" },
      5: { kind: "out" },
    });
    expect(shown.newcomers).toEqual([2]);
  });
});

const granary = { kind: "granary" as const };
const hunter = { kind: "hunter" as const };
const passer = (rank: number) => ({ kind: "passer" as const, rank });

describe("changedMembers", () => {
  it("lists the members whose role or field to keep differs from what was read", () => {
    const base = { roles: { "1": granary, "2": passer(1), "3": hunter }, keep: { "3": 1_000 } };
    const draft = { roles: { "1": granary, "2": passer(2), "3": hunter, "4": hunter }, keep: { "3": 2_000 } };

    expect(changedMembers(base, draft)).toEqual(["2", "3", "4"]);
    expect(changedMembers(base, base)).toEqual([]);
  });
});

describe("rebaseRoles", () => {
  it("puts my changes on the newer roles, for the members I touched only", () => {
    const base = { roles: { "1": granary, "2": passer(1), "3": hunter }, keep: { "3": 1_000 } };
    // Noctis saved meanwhile: Okapi passer 2, Zeph keeps 5 000.
    const theirs = { roles: { "1": granary, "2": passer(2), "3": hunter }, keep: { "3": 5_000 } };
    // I made Zeph a passer (no field to keep any more) and Okapi stays as I read it.
    const mine = { roles: { "1": granary, "2": passer(1), "3": passer(1) }, keep: {} };

    expect(rebaseRoles(base, mine, theirs)).toEqual({
      roles: { "1": granary, "2": passer(2), "3": passer(1) },
      keep: {},
    });
  });
});
