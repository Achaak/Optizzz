// The background half of the link to an Optizzz account: it alone keeps the token and talks to optizzz.fr, on a
// message from the settings (a click, or opening them) or from the link script on « Connecter l'extension ». Never on a
// timer, and nothing at all while the extension is not linked (ADR 0005). It also answers the space script of an
// Alliance Space page with the last Members page list. See docs/features/site-comptes-espaces.md.
import { CONNECT_EXTENSION_PATH } from "@optizzz/game/site-links/extension-link";
import { serverById } from "@optizzz/game/servers";
import { SITE_URL } from "@optizzz/game/site-links/site";
import { SPACES_PATH, type MembersAnswer } from "@optizzz/game/site-links/space-bridge";
import { loadAllianceMembers } from "@/data/alliance-members";
import {
  decline,
  forgetLink,
  isLinkRequested,
  loadAttachedPlayers,
  loadCurrentPlayer,
  loadDeclined,
  loadLastGameServer,
  loadLink,
  storeAttachedPlayers,
  storeLink,
} from "@/data/optizzz-account";
import { siteApi } from "./api";
import { syncLinkScript } from "./link-script";
import {
  isAccountAction,
  isLinkMessage,
  isSpaceMessage,
  type AccountAction,
  type AccountStatus,
  type LinkMessage,
  type SpaceMessage,
} from "./messages";
import { gameServerOf, offerFor } from "./offer";
import { CONNECT_PAGE, SITE_PERMISSION, SITE_ORIGIN_PATTERN } from "./permission";

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

interface Dependencies {
  now: () => Date;
  fetch: Fetch;
  /** optizzz.fr granted (and, on Firefox, the consent to send data there). */
  permitted: () => Promise<boolean>;
  openConnectPage: () => Promise<unknown>;
}

type Notice = AccountStatus["notice"];

const REMOVED: Notice = {
  kind: "error",
  text: "Cette extension a été retirée de votre Compte Optizzz : connectez-la de nouveau pour rattacher vos Joueurs.",
};

export function accountService({ now, fetch, permitted, openConnectPage }: Dependencies) {
  /** The block's state; with `refresh`, the account's Players are read again on the site first. */
  async function status(origin: string | null, notice: Notice = null, refresh = false): Promise<AccountStatus> {
    let link = await loadLink();
    const allowed = await permitted();
    if (link && allowed && refresh) {
      const players = await siteApi(link.token, fetch).players();
      if (players.ok) await storeAttachedPlayers(players.value);
      else if (players.unlinked) {
        await forgetLink();
        link = null;
        notice ??= REMOVED;
      }
    }
    const where = origin ?? (await loadLastGameServer());
    const attached = link ? await loadAttachedPlayers() : [];
    const offer = offerFor({
      linked: link !== null && allowed,
      origin: where,
      pseudo: where && gameServerOf(where) ? await loadCurrentPlayer(where) : null,
      attached,
      declined: await loadDeclined(),
    });
    return {
      linked: link !== null,
      permitted: allowed,
      offer: offer && { origin: offer.origin, serverName: offer.server.name, pseudo: offer.pseudo },
      players: attached,
      notice,
    };
  }

  /** « Rattacher »: only the Player the offer names, read from storage here, never one a message would bring. */
  async function attach(origin: string): Promise<AccountStatus> {
    const current = await status(origin);
    const link = await loadLink();
    if (!current.offer || !link) return current;
    const server = gameServerOf(origin);
    if (!server) return current;
    const result = await siteApi(link.token, fetch).attach(server.id, current.offer.pseudo);
    if (result.ok) {
      await storeAttachedPlayers(result.value);
      return status(origin, {
        kind: "success",
        text: `${current.offer.pseudo} (${server.name}) est rattaché à votre Compte Optizzz.`,
      });
    }
    if (result.unlinked) {
      await forgetLink();
      return status(origin, REMOVED);
    }
    return { ...current, notice: { kind: "error", text: result.message } };
  }

  async function declineOffer(origin: string): Promise<AccountStatus> {
    const current = await status(origin);
    const server = gameServerOf(origin);
    if (current.offer && server) await decline(server.id, current.offer.pseudo);
    return status(origin);
  }

  /** « Déconnecter »: the site removes the token; the extension forgets it even when the site cannot be reached. */
  async function disconnect(origin: string | null): Promise<AccountStatus> {
    const link = await loadLink();
    let notice: Notice = { kind: "success", text: "Extension déconnectée de votre Compte Optizzz." };
    if (link) {
      const result = (await permitted()) ? await siteApi(link.token, fetch).unlink() : null;
      if (!result || (!result.ok && !result.unlinked))
        notice = {
          kind: "error",
          text: "Extension déconnectée ici, mais optizzz.fr n'a pas pu être prévenu : retirez-la aussi depuis « Mon compte » sur le site.",
        };
    }
    await forgetLink();
    return status(origin, notice);
  }

  /**
   * « Donner l'accès » on an Alliance Space page: the last Members page list kept for the server, for the page in this
   * browser to check the newcomer's pseudo. Only while the extension is linked; nothing is fetched, from the game or
   * the site, and the list goes to the page alone.
   */
  async function members(serverId: string): Promise<MembersAnswer> {
    const server = serverById(serverId);
    if (!(await loadLink()) || !(await permitted()) || server?.id !== serverId) return { status: "unlinked" };
    const list = await loadAllianceMembers(server.origin);
    return {
      status: "linked",
      members: list && { tag: list.tag, pseudos: list.pseudos, readAt: list.readAt.getTime() },
    };
  }

  /** The link script asks whether it may take a token: only after « Connecter mon Compte Optizzz ». */
  async function linkStart(): Promise<{ ok: boolean }> {
    return { ok: (await permitted()) && (await isLinkRequested(now())) };
  }

  /** The link script hands over the token: one per browser, so a previous one is removed from the site. */
  async function linkToken(token: string): Promise<{ ok: boolean }> {
    if (!(await linkStart()).ok) return { ok: false };
    const previous = await loadLink();
    if (previous && previous.token !== token) await siteApi(previous.token, fetch).unlink();
    await storeLink(token, now());
    await status(null, null, true);
    return { ok: true };
  }

  return {
    status,
    attach,
    decline: declineOffer,
    disconnect,
    linkStart,
    linkToken,
    members,
    connect: openConnectPage,
  };
}

type Sender = Browser.runtime.MessageSender;

/**
 * Who sends a message: one of the extension's pages, its scripts on the game, its link script on optizzz.fr
 * « Connecter l'extension », or its space script on an Alliance Space page.
 */
export function senderKind(
  sender: Sender,
  extensionId: string,
  extensionBase: string,
): "page" | "game" | "link" | "space" | null {
  if (sender.id !== extensionId || !sender.url) return null;
  if (sender.url.startsWith(extensionBase)) return "page";
  let url: URL;
  try {
    url = new URL(sender.url);
  } catch {
    return null;
  }
  if (!sender.tab) return null;
  if (gameServerOf(url.origin)) return "game";
  if (url.origin === SITE_URL && url.pathname === CONNECT_EXTENSION_PATH) return "link";
  if (url.origin === SITE_URL && url.pathname.startsWith(`${SPACES_PATH}/`)) return "space";
  return null;
}

/**
 * What a message gets: the settings may ask from a page or the game; the token comes only from the link script; the
 * Members page list goes only to the space script.
 */
export function answer(
  service: ReturnType<typeof accountService>,
  message: AccountAction | LinkMessage | SpaceMessage,
  from: ReturnType<typeof senderKind>,
): Promise<unknown> | null {
  if (message.type === "optizzz-space") return from === "space" ? service.members(message.server) : null;
  if (message.type === "optizzz-link") {
    if (from !== "link") return null;
    return message.action === "start" ? service.linkStart() : service.linkToken(message.token);
  }
  if (from !== "page" && from !== "game") return null;
  switch (message.action) {
    case "status":
      return service.status(message.origin, null, true);
    case "attach":
      return service.attach(message.origin);
    case "decline":
      return service.decline(message.origin);
    case "disconnect":
      return service.disconnect(null);
    case "connect":
      return service.connect().then(() => null);
  }
}

export function setUpOptizzzAccount(): void {
  const service = accountService({
    now: () => new Date(),
    fetch: (url, init) => fetch(url, init),
    permitted: () => browser.permissions.contains(SITE_PERMISSION),
    openConnectPage: () => browser.tabs.create({ url: browser.runtime.getURL(CONNECT_PAGE) }),
  });
  const sync = () => {
    syncLinkScript().catch((error: unknown) => {
      console.error("[Optizzz] could not register the link script of optizzz.fr", error);
    });
  };
  sync();
  const concernsSite = (permissions: Browser.permissions.Permissions) =>
    permissions.origins?.includes(SITE_ORIGIN_PATTERN) === true ||
    permissions.permissions?.includes("scripting") === true;
  browser.permissions.onAdded.addListener((permissions) => {
    if (concernsSite(permissions)) sync();
  });
  browser.permissions.onRemoved.addListener((permissions) => {
    if (concernsSite(permissions)) sync();
  });

  browser.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
    if (!isAccountAction(message) && !isLinkMessage(message) && !isSpaceMessage(message)) return false;
    const reply = answer(service, message, senderKind(sender, browser.runtime.id, browser.runtime.getURL("/")));
    if (!reply) {
      sendResponse(null);
      return false;
    }
    reply.then(sendResponse, (error: unknown) => {
      console.error("[Optizzz] Optizzz account: the message failed", error);
      sendResponse(null);
    });
    return true;
  });
}
