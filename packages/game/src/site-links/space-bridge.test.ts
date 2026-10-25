import { describe, expect, it } from "vitest";
import { isMembersReply, isMembersRequest, MEMBERS_REPLY, MEMBERS_REQUEST } from "./space-bridge";

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
