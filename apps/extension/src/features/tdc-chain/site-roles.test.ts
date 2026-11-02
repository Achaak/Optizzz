import { describe, expect, it } from "vitest";
import { effectiveChain, SITE_ROLES_NO_KEY } from "./site-roles";

const local = { roles: { "1": { kind: "hunter" as const } }, keep: { "1": 500 } };
const site = { roles: { "1": { kind: "granary", rank: 1 } as const }, keep: { "2": 1_500 } };

describe("effectiveChain", () => {
  it("takes the space's roles and fields to keep, read-only, when the extension could open them", () => {
    expect(effectiveChain(local, { problem: null, record: site, spaceId: "s" })).toEqual({
      roles: site.roles,
      keep: site.keep,
      fromSite: true,
      spaceId: "s",
      note: null,
    });
  });

  it("keeps the player's own roles, editable, without a space or a space without roles", () => {
    for (const answer of [null, { problem: "none" as const }, { problem: "no-space" as const }])
      expect(effectiveChain(local, answer)).toEqual({ ...local, fromSite: false, spaceId: null, note: null });
  });

  it("keeps the player's own roles with a note when the space's cannot be opened here", () => {
    expect(effectiveChain(local, { problem: "no-key" })).toEqual({
      ...local,
      fromSite: false,
      spaceId: null,
      note: SITE_ROLES_NO_KEY,
    });
  });
});
