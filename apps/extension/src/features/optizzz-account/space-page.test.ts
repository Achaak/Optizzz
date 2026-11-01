import {
  ALLIANCE_KEYS,
  FORGET_KEYS,
  CHAIN_ROLES_REPLY,
  CHAIN_ROLES_REQUEST,
  MEMBERS_REPLY,
  MEMBERS_REQUEST,
  SPACE_BRIDGE_ATTRIBUTE,
} from "@optizzz/game/site-links/space-bridge";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runSpacePage } from "./space-page";

const list = { tag: "ABC", pseudos: ["Bruno"], readAt: 1_761_400_000_000 };
let stop: (() => void) | undefined;

afterEach(() => {
  stop?.();
  document.documentElement.removeAttribute(SPACE_BRIDGE_ATTRIBUTE);
});

function start(reply: unknown) {
  const send = vi.fn(() => Promise.resolve(reply));
  const posted = vi.spyOn(window, "postMessage").mockImplementation(() => undefined);
  stop = runSpacePage({ win: window, send });
  return { send, posted };
}

const request = (init: Partial<MessageEventInit> = {}) =>
  window.dispatchEvent(
    new MessageEvent("message", {
      data: { type: MEMBERS_REQUEST, id: "r1", server: "s5" },
      origin: window.location.origin,
      source: window,
      ...init,
    }),
  );

describe("the space script on an Alliance Space page", () => {
  it("says it is there, and hands the page the background's Members page list", async () => {
    const { send, posted } = start({ status: "linked", members: list });
    expect(document.documentElement.getAttribute(SPACE_BRIDGE_ATTRIBUTE)).toBe("ready");
    request();
    await vi.waitFor(() => {
      expect(posted).toHaveBeenCalledWith(
        { type: MEMBERS_REPLY, id: "r1", answer: { status: "linked", members: list } },
        window.location.origin,
      );
    });
    expect(send).toHaveBeenCalledWith({ type: "optizzz-space", action: "members", server: "s5" });
  });

  it("hands the background the Clé d'alliance the page gives, and « Se déconnecter », from its own page only", () => {
    const { send } = start(null);
    const keys = {
      type: ALLIANCE_KEYS,
      spaceId: "0b9d6f0e-3c4a-4f5e-9a7b-1c2d3e4f5a6b",
      keys: [{ version: 1, key: "A".repeat(43) }],
      expiresAt: null,
    };
    request({ data: keys, source: null });
    request({ data: keys, origin: "https://evil.example" });
    request({ data: { ...keys, keys: [{ version: 1, key: "short" }] } });
    expect(send).not.toHaveBeenCalled();
    request({ data: keys });
    request({ data: { type: FORGET_KEYS } });
    expect(send.mock.calls).toEqual([
      [{ type: "optizzz-space", action: "keys", spaceId: keys.spaceId, keys: keys.keys, expiresAt: null }],
      [{ type: "optizzz-space", action: "forget" }],
    ]);
  });

  it("hears only its own page, and answers « unlinked » when the background does not answer", async () => {
    const { send, posted } = start(null);
    request({ source: null });
    request({ origin: "https://evil.example" });
    request({ data: { type: MEMBERS_REQUEST, id: "r1", server: "../../" } });
    expect(send).not.toHaveBeenCalled();
    request();
    await vi.waitFor(() => {
      expect(posted).toHaveBeenCalledWith(
        { type: MEMBERS_REPLY, id: "r1", answer: { status: "unlinked" } },
        window.location.origin,
      );
    });
  });

  it("hands the page the roles of the extension's own chain, for « Reprendre les rôles de votre extension »", async () => {
    const { send, posted } = start({ status: "linked", record: '{"v":1}' });
    request({ data: { type: CHAIN_ROLES_REQUEST, id: "r2", server: "s5", spaceId: "abc" } });
    await vi.waitFor(() => {
      expect(posted).toHaveBeenCalledWith(
        { type: CHAIN_ROLES_REPLY, id: "r2", answer: { status: "linked", record: '{"v":1}' } },
        window.location.origin,
      );
    });
    expect(send).toHaveBeenCalledWith({ type: "optizzz-space", action: "chain-roles", server: "s5", spaceId: "abc" });
  });
});
