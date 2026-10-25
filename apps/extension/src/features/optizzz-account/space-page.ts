// The space script's work on an Alliance Space page of optizzz.fr, apart from its entrypoint so a test can run it. It
// runs in the extension's isolated world and answers the page's requests for the last list of the game's Members page
// (@optizzz/game/site-links/space-bridge.ts), which « Donner l'accès » checks and the departure alerts compare in an
// Admin's or Délégué's browser. Only requests
// from the page's own window are heard, and the reply goes back to the page's origin alone.
import {
  isMembersAnswer,
  isMembersRequest,
  MEMBERS_REPLY,
  SPACE_BRIDGE_ATTRIBUTE,
  type MembersAnswer,
  type MembersReply,
} from "@optizzz/game/site-links/space-bridge";
import type { SpaceMessage } from "./messages";

interface SpacePageDependencies {
  win: Window;
  send: (message: SpaceMessage) => Promise<unknown>;
}

const UNLINKED: MembersAnswer = { status: "unlinked" };

/** Starts listening; returns how to stop (for the tests). */
export function runSpacePage({ win, send }: SpacePageDependencies): () => void {
  const listener = (event: MessageEvent) => {
    if (event.source !== win || event.origin !== win.location.origin || !isMembersRequest(event.data)) return;
    const { id, server } = event.data;
    send({ type: "optizzz-space", action: "members", server })
      .catch(() => null)
      .then((reply) => {
        const answer = isMembersAnswer(reply) ? reply : UNLINKED;
        win.postMessage({ type: MEMBERS_REPLY, id, answer } satisfies MembersReply, win.location.origin);
      })
      .catch((error: unknown) => {
        console.error("[Optizzz] the Members page could not be handed to the page", error);
      });
  };
  win.addEventListener("message", listener);
  win.document.documentElement.setAttribute(SPACE_BRIDGE_ATTRIBUTE, "ready");
  return () => {
    win.removeEventListener("message", listener);
  };
}
