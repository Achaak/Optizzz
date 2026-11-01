// Asks the extension's space script, in this page, for its last list of the game's Members page
// (@optizzz/game/site-links/space-bridge.ts). Null when no extension answers: not installed, or optizzz.fr not granted.
import type { AllianceKeyring } from "@optizzz/crypto/alliance-key";
import { toBase64Url } from "@optizzz/crypto/encoding";
import {
  ALLIANCE_KEYS,
  CHAIN_ROLES_REQUEST,
  isChainRolesReply,
  type ChainRolesBridgeAnswer,
  type ChainRolesRequest,
  FORGET_KEYS,
  isMembersReply,
  MEMBERS_REQUEST,
  SPACE_BRIDGE_ATTRIBUTE,
  type AllianceKeysMessage,
  type ForgetKeysMessage,
  type MembersAnswer,
  type MembersRequest,
} from "@optizzz/game/site-links/space-bridge";

/**
 * Hands the extension's script in this page every version of the space's Clé d'alliance this page opened, never the
 * private key: the extension encrypts the Envois with it, for as long as this device keeps the opened key
 * (`expiresAt`, or null for the browser's session). Nothing happens without the extension.
 */
export function handKeysToExtension(spaceId: string, keyring: AllianceKeyring, expiresAt: number | null): void {
  const message: AllianceKeysMessage = {
    type: ALLIANCE_KEYS,
    spaceId,
    keys: keyring.map((k) => ({ version: k.version, key: toBase64Url(k.key) })),
    expiresAt,
  };
  whenScriptReady(() => window.postMessage(message, window.location.origin));
}

/** The extension's script marks <html> once it listens: wait for it a little, since it may come after this page. */
function whenScriptReady(post: () => void, waitMs = 10_000): void {
  const root = document.documentElement;
  if (root.hasAttribute(SPACE_BRIDGE_ATTRIBUTE)) {
    post();
    return;
  }
  const observer = new MutationObserver(() => {
    if (!root.hasAttribute(SPACE_BRIDGE_ATTRIBUTE)) return;
    observer.disconnect();
    clearTimeout(timer);
    post();
  });
  const timer = setTimeout(() => observer.disconnect(), waitMs);
  observer.observe(root, { attributes: true, attributeFilter: [SPACE_BRIDGE_ATTRIBUTE] });
}

/** « Se déconnecter » and the account's deletion: the extension forgets the Clé d'alliance too. */
export function tellExtensionToForgetKeys(): void {
  window.postMessage({ type: FORGET_KEYS } satisfies ForgetKeysMessage, window.location.origin);
}

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

/**
 * « Reprendre les rôles de votre extension » (docs/features/site-chaine.md): the roles set in the linked extension's
 * chain for this server, as the text of the space's record. Null when no extension answers.
 */
export function askExtensionForChainRoles(
  server: string,
  spaceId: string,
  timeoutMs = TIMEOUT_MS,
): Promise<ChainRolesBridgeAnswer | null> {
  const id = crypto.randomUUID();
  return new Promise((resolve) => {
    const done = (answer: ChainRolesBridgeAnswer | null) => {
      window.removeEventListener("message", listener);
      clearTimeout(timer);
      resolve(answer);
    };
    const listener = (event: MessageEvent) => {
      if (event.source !== window || event.origin !== window.location.origin) return;
      if (isChainRolesReply(event.data) && event.data.id === id) done(event.data.answer);
    };
    const ready = document.documentElement.hasAttribute(SPACE_BRIDGE_ATTRIBUTE);
    const timer = setTimeout(() => done(null), ready ? timeoutMs : timeoutMs / 2);
    window.addEventListener("message", listener);
    window.postMessage(
      { type: CHAIN_ROLES_REQUEST, id, server, spaceId } satisfies ChainRolesRequest,
      window.location.origin,
    );
  });
}
