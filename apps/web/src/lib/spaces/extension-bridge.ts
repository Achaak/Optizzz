// Asks the extension's space script, in this page, for its last list of the game's Members page
// (@optizzz/game/site-links/space-bridge.ts). Null when no extension answers: not installed, or optizzz.fr not granted.
import {
  isMembersReply,
  MEMBERS_REQUEST,
  SPACE_BRIDGE_ATTRIBUTE,
  type MembersAnswer,
  type MembersRequest,
} from "@optizzz/game/site-links/space-bridge";

const TIMEOUT_MS = 4000;

export function askExtensionForMembers(server: string, timeoutMs = TIMEOUT_MS): Promise<MembersAnswer | null> {
  const id = crypto.randomUUID();
  return new Promise((resolve) => {
    const done = (answer: MembersAnswer | null) => {
      window.removeEventListener("message", listener);
      clearTimeout(timer);
      resolve(answer);
    };
    const listener = (event: MessageEvent) => {
      if (event.source !== window || event.origin !== window.location.origin) return;
      if (isMembersReply(event.data) && event.data.id === id) done(event.data.answer);
    };
    // Without the script's mark, give it a moment only: it marks <html> as soon as it runs.
    const ready = document.documentElement.hasAttribute(SPACE_BRIDGE_ATTRIBUTE);
    const timer = setTimeout(() => done(null), ready ? timeoutMs : timeoutMs / 2);
    window.addEventListener("message", listener);
    window.postMessage({ type: MEMBERS_REQUEST, id, server } satisfies MembersRequest, window.location.origin);
  });
}
