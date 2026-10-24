// Messages to the background script, which alone holds the token and talks to optizzz.fr. The settings (popup and the
// game's dialog) ask for the account's state and act on a click; the link script of « Connecter l'extension » hands
// over the token. The background checks who sends each one (background.ts).
import type { AttachedPlayer } from "@/data/optizzz-account";

/** The account block of « Fonctionnalités ». */
export interface AccountStatus {
  linked: boolean;
  /** optizzz.fr (and on Firefox the data consent) granted. */
  permitted: boolean;
  /** « Rattacher Pseudo (S5) à votre Compte Optizzz », when there is one to make. */
  offer: { origin: string; serverName: string; pseudo: string } | null;
  players: AttachedPlayer[];
  /** What the last action did, to show the player. */
  notice: { kind: "success" | "error"; text: string } | null;
}

export type AccountAction =
  | { type: "optizzz-account"; action: "status"; origin: string | null }
  | { type: "optizzz-account"; action: "attach"; origin: string }
  | { type: "optizzz-account"; action: "decline"; origin: string }
  | { type: "optizzz-account"; action: "disconnect" }
  | { type: "optizzz-account"; action: "connect" };

export type LinkMessage =
  { type: "optizzz-link"; action: "start" } | { type: "optizzz-link"; action: "token"; token: string };

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
    default:
      return false;
  }
}

export function isLinkMessage(message: unknown): message is LinkMessage {
  const m = record(message);
  if (m?.type !== "optizzz-link") return false;
  return m.action === "start" || (m.action === "token" && typeof m.token === "string" && /^[\w-]{43}$/.test(m.token));
}

/** From the settings: the background's answer. */
export async function askAccount(action: AccountAction): Promise<AccountStatus | null> {
  return browser.runtime.sendMessage<AccountAction, AccountStatus | null>(action);
}
