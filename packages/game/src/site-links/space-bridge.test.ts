import { describe, expect, it } from "vitest";
import {
  ALLIANCE_KEYS,
  FORGET_KEYS,
  isAllianceKeysMessage,
  isForgetKeysMessage,
  isMembersReply,
  isMembersRequest,
  MEMBERS_REPLY,
  MEMBERS_REQUEST,
} from "./space-bridge";

describe("the Members page between an Alliance Space and the extension", () => {
  it("takes a request for a server and nothing else", () => {
    expect(isMembersRequest({ type: MEMBERS_REQUEST, id: "1", server: "s5" })).toBe(true);
    expect(isMembersRequest({ type: MEMBERS_REQUEST, id: "1", server: "https://evil.example" })).toBe(false);
    expect(isMembersRequest({ type: MEMBERS_REQUEST, id: "", server: "s5" })).toBe(false);
    expect(isMembersRequest({ type: "other", id: "1", server: "s5" })).toBe(false);
    expect(isMembersRequest(null)).toBe(false);
  });

  it("reads a reply with a list, without one, or from an unlinked extension", () => {
    const list = { tag: "ABC", pseudos: ["Calystene"], readAt: 1_761_400_000_000 };
    expect(isMembersReply({ type: MEMBERS_REPLY, id: "1", answer: { status: "linked", members: list } })).toBe(true);
    expect(isMembersReply({ type: MEMBERS_REPLY, id: "1", answer: { status: "linked", members: null } })).toBe(true);
    expect(isMembersReply({ type: MEMBERS_REPLY, id: "1", answer: { status: "unlinked" } })).toBe(true);
    expect(
      isMembersReply({
        type: MEMBERS_REPLY,
        id: "1",
        answer: { status: "linked", members: { ...list, pseudos: [1] } },
      }),
    ).toBe(false);
    expect(isMembersReply({ type: MEMBERS_REPLY, id: "1", answer: { status: "maybe" } })).toBe(false);
  });
});

describe("the Clé d'alliance handed to the extension", () => {
  const spaceId = "0b9d6f0e-3c4a-4f5e-9a7b-1c2d3e4f5a6b";
  const key = "A".repeat(43);

  it("takes every version of a space, for the session or until a date", () => {
    expect(isAllianceKeysMessage({ type: ALLIANCE_KEYS, spaceId, keys: [{ version: 1, key }], expiresAt: null })).toBe(
      true,
    );
    expect(
      isAllianceKeysMessage({
        type: ALLIANCE_KEYS,
        spaceId,
        keys: [
          { version: 1, key },
          { version: 2, key },
        ],
        expiresAt: 1_761_400_000_000,
      }),
    ).toBe(true);
  });

  it("refuses anything that is not a key", () => {
    const base = { type: ALLIANCE_KEYS, spaceId, expiresAt: null };
    expect(isAllianceKeysMessage({ ...base, keys: [] })).toBe(false);
    expect(isAllianceKeysMessage({ ...base, keys: [{ version: 0, key }] })).toBe(false);
    expect(isAllianceKeysMessage({ ...base, keys: [{ version: 1, key: "short" }] })).toBe(false);
    expect(isAllianceKeysMessage({ ...base, spaceId: "../x", keys: [{ version: 1, key }] })).toBe(false);
    expect(isForgetKeysMessage({ type: FORGET_KEYS })).toBe(true);
    expect(isForgetKeysMessage({ type: ALLIANCE_KEYS })).toBe(false);
  });
});
