// The space script's work on optizzz.fr, apart from its entrypoint so a test can run it. It runs in the extension's
// isolated world, on the pages of the Alliance Spaces and on « Mon compte », and hears only its own page's window
// (@optizzz/game/site-links/space-bridge.ts):
// - the requests for the last list of the game's Members page, which « Donner l'accès » checks and the departure
//   alerts compare in an Admin's or Délégué's browser; the reply goes back to the page's origin alone;
// - the roles of the extension's own chain, for « Reprendre les rôles de votre extension » (site-chaine.md);
// - the Clé d'alliance the space page hands over once its access is open (never the private key), and
//   « Se déconnecter », for the background to keep or forget it (docs/features/site-envois.md).
import {
  CHAIN_ROLES_REPLY,
  isAllianceKeysMessage,
  isChainRolesAnswer,
  isChainRolesRequest,
  isForgetKeysMessage,
  isMembersAnswer,
  isMembersRequest,
  MEMBERS_REPLY,
  SPACE_BRIDGE_ATTRIBUTE,
  type ChainRolesBridgeAnswer,
  type ChainRolesReply,
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
  const forward = (message: SpaceMessage) => {
    send(message).catch((error: unknown) => {
      console.error("[Optizzz] the Clé d'alliance could not be handed to the extension", error);
    });
  };
  const listener = (event: MessageEvent) => {
    if (event.source !== win || event.origin !== win.location.origin) return;
    const data: unknown = event.data;
    if (isAllianceKeysMessage(data)) {
      forward({
        type: "optizzz-space",
        action: "keys",
        spaceId: data.spaceId,
        keys: data.keys,
        expiresAt: data.expiresAt,
      });
      return;
    }
    if (isForgetKeysMessage(data)) {
      forward({ type: "optizzz-space", action: "forget" });
      return;
    }
    if (isChainRolesRequest(data)) {
      const { id, server, spaceId } = data;
      send({ type: "optizzz-space", action: "chain-roles", server, spaceId })
        .catch(() => null)
        .then((reply) => {
          const answer: ChainRolesBridgeAnswer = isChainRolesAnswer(reply) ? reply : { status: "unlinked" };
          win.postMessage({ type: CHAIN_ROLES_REPLY, id, answer } satisfies ChainRolesReply, win.location.origin);
        })
        .catch((error: unknown) => {
          console.error("[Optizzz] the chain's roles could not be handed to the page", error);
        });
      return;
    }
    if (!isMembersRequest(data)) return;
    const { id, server } = data;
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
