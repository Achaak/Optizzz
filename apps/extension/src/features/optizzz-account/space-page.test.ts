import { MEMBERS_REPLY, MEMBERS_REQUEST, SPACE_BRIDGE_ATTRIBUTE } from "@optizzz/game/site-links/space-bridge";
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
});
