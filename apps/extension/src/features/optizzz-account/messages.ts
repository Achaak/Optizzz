// Messages to the background script, which alone holds the token and talks to optizzz.fr. The settings (popup and the
// game's dialog) ask for the account's state and act on a click; the link script of « Connecter l'extension » hands
// over the token; the space script of the Alliance Spaces asks for the last Members page list. The background checks
// who sends each one (background.ts).
import type { EnvoiChoices } from "@optizzz/game/site-links/envois";
import { isHandedKeys, type HandedKey } from "@optizzz/game/site-links/space-bridge";
import type { AttachedPlayer } from "@/data/optizzz-account";
import type { JoueurEnvois } from "./envois";

/** The account block of « Fonctionnalités ». */
export interface AccountStatus {
  linked: boolean;
  /** optizzz.fr (and on Firefox the data consent) granted. */
  permitted: boolean;
  /** « Rattacher Pseudo (S5) à votre Compte Optizzz », when there is one to make. */
  offer: { origin: string; serverName: string; pseudo: string } | null;
  players: AttachedPlayer[];
  /** Each attached Joueur's Envois: what they send, and what stops it. */
  envois: JoueurEnvois[];
  /** What the last action did, to show the player. */
  notice: { kind: "success" | "error"; text: string } | null;
}

export type AccountAction =
  | { type: "optizzz-account"; action: "status"; origin: string | null }
  | { type: "optizzz-account"; action: "attach"; origin: string }
  | { type: "optizzz-account"; action: "decline"; origin: string }
  | { type: "optizzz-account"; action: "disconnect" }
  | { type: "optizzz-account"; action: "connect" }
  /** A category checked or unchecked for a Joueur. */
  | { type: "optizzz-account"; action: "choose"; server: string; pseudo: string; choices: EnvoiChoices };

export type LinkMessage =
  { type: "optizzz-link"; action: "start" } | { type: "optizzz-link"; action: "token"; token: string };

/**
 * From the space script on optizzz.fr: the last Members page list kept for a server (« s5 »), the Clé d'alliance the
 * space page hands over, and « Se déconnecter » on the site.
 */
export type SpaceMessage =
  | { type: "optizzz-space"; action: "members"; server: string }
  | { type: "optizzz-space"; action: "keys"; spaceId: string; keys: HandedKey[]; expiresAt: number | null }
  | { type: "optizzz-space"; action: "forget" };

/**
 * From the game's pages: one opened (the relève), commerce.php asking for the alliance's convoys to it, and Armee.php,
 * the Plan de flood and the targets asking for the alliance's floods on their way.
 */
export type EnvoiMessage =
  | { type: "optizzz-envois"; action: "page-open" }
  | { type: "optizzz-envois"; action: "incoming" | "floods"; origin: string };

const record = (message: unknown): Record<string, unknown> | null =>
  typeof message === "object" && message !== null ? (message as Record<string, unknown>) : null;

export function isAccountAction(message: unknown): message is AccountAction {
  const m = record(message);
  if (m?.type !== "optizzz-account") return false;
  switch (m.action) {
    case "status":
      return m.origin === null || typeof m.origin === "string";
    case "attach":
    case "decline":
      return typeof m.origin === "string";
    case "disconnect":
    case "connect":
      return true;
    case "choose":
      return typeof m.server === "string" && typeof m.pseudo === "string" && isChoices(m.choices);
    default:
      return false;
  }
}

function isChoices(value: unknown): value is EnvoiChoices {
  const c = record(value);
  return (
    c !== null &&
    ["production", "convoys", "floods", "hunts", "levels"].every((k) => typeof c[k] === "boolean") &&
    (c.army === "none" || c.army === "count" || c.army === "units")
  );
}

export function isEnvoiMessage(message: unknown): message is EnvoiMessage {
  const m = record(message);
  if (m?.type !== "optizzz-envois") return false;
  return (
    m.action === "page-open" || ((m.action === "incoming" || m.action === "floods") && typeof m.origin === "string")
  );
}

export function isLinkMessage(message: unknown): message is LinkMessage {
  const m = record(message);
  if (m?.type !== "optizzz-link") return false;
  return m.action === "start" || (m.action === "token" && typeof m.token === "string" && /^[\w-]{43}$/.test(m.token));
}

export function isSpaceMessage(message: unknown): message is SpaceMessage {
  const m = record(message);
  if (m?.type !== "optizzz-space") return false;
  if (m.action === "members") return typeof m.server === "string";
  if (m.action === "forget") return true;
  return (
    m.action === "keys" &&
    typeof m.spaceId === "string" &&
    /^[0-9a-f-]{36}$/.test(m.spaceId) &&
    isHandedKeys(m.keys) &&
    (m.expiresAt === null || (typeof m.expiresAt === "number" && Number.isFinite(m.expiresAt)))
  );
}

/** From a game page: the relève, or what the alliance sent that this page shows (convoys, floods). */
export async function askEnvois<T>(message: EnvoiMessage): Promise<T | null> {
  return browser.runtime.sendMessage<EnvoiMessage, T | null>(message);
}

/** From the settings: the background's answer. */
export async function askAccount(action: AccountAction): Promise<AccountStatus | null> {
  return browser.runtime.sendMessage<AccountAction, AccountStatus | null>(action);
}
