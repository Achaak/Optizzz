// The background half of the link to an Optizzz account: it alone keeps the token and talks to optizzz.fr, on a
// message from the settings (a click, or opening them) or from the link script on « Connecter l'extension », and for
// the Envois (envois.ts): a few seconds after a game page changed what a checked category keeps, and the relève, which
// only reads the site. Nothing at all while the extension is not linked (ADR 0005). It also answers the space script
// of an Alliance Space page with the last Members page list, and takes the Clé d'alliance from it. See
// docs/features/site-comptes-espaces.md and docs/features/site-envois.md.
import { CONNECT_EXTENSION_PATH } from "@optizzz/game/site-links/extension-link";
import { serverById } from "@optizzz/game/servers";
import { SITE_URL } from "@optizzz/game/site-links/site";
import type { EnvoiCrypto } from "@optizzz/game/site-links/envois";
import { STATE_CATEGORIES } from "@optizzz/game/site-links/envoi-states";
import {
  ACCOUNT_PATH,
  ALLIANCE_KEYS,
  SPACES_PATH,
  type HandedKey,
  type MembersAnswer,
} from "@optizzz/game/site-links/space-bridge";
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
import { envoiService, RELEVE_MINUTES, type EnvoiService } from "./envois";
import { syncLinkScript } from "./link-script";
import {
  isAccountAction,
  isEnvoiMessage,
  isLinkMessage,
  isSpaceMessage,
  type AccountAction,
  type AccountStatus,
  type EnvoiMessage,
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
  /** The Envois (envois.ts): the Joueurs' choices, the Clé d'alliance, the relève. */
  envois: Pick<
    EnvoiService,
    "status" | "choose" | "forget" | "receiveKeys" | "releve" | "incoming" | "floods" | "states"
  >;
}

type Notice = AccountStatus["notice"];

const REMOVED: Notice = {
  kind: "error",
  text: "Cette extension a été retirée de votre Compte Optizzz : connectez-la de nouveau pour rattacher vos Joueurs.",
};

export function accountService({ now, fetch, permitted, openConnectPage, envois }: Dependencies) {
  /** The block's state; with `refresh`, the account's Players are read again on the site first. */
  async function status(origin: string | null, notice: Notice = null, refresh = false): Promise<AccountStatus> {
    let link = await loadLink();
    const allowed = await permitted();
    if (link && allowed && refresh) {
      const players = await siteApi(link.token, fetch).players();
      if (players.ok) await storeAttachedPlayers(players.value);
      else if (players.unlinked) {
        await forgetLink();
        await envois.forget();
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
      envois: link && allowed ? await envois.status() : [],
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
      await envois.forget();
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
    // The Clé d'alliance goes with the link, and whatever was read with it.
    await envois.forget();
    return status(origin, notice);
  }

  /**
   * « Donner l'accès » and the departure alerts on an Alliance Space page: the last Members page list kept for the
   * server, for the page in this browser to check the newcomer's pseudo or find the members who left. Only while the
   * extension is linked; nothing is fetched, from the game or the site, and the list goes to the page alone.
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

  /** A category checked or unchecked for one of the account's Joueurs. */
  async function choose(message: Extract<AccountAction, { action: "choose" }>): Promise<AccountStatus> {
    const attached = await loadAttachedPlayers();
    if (attached.some((p) => p.server === message.server && p.pseudo === message.pseudo))
      await envois.choose(message.server, message.pseudo, message.choices);
    return status(null);
  }

  return {
    status,
    attach,
    choose,
    envois,
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
  if (url.origin === SITE_URL && (url.pathname.startsWith(`${SPACES_PATH}/`) || url.pathname === ACCOUNT_PATH))
    return "space";
  return null;
}

/**
 * What a message gets: the settings may ask from a page or the game; the token comes only from the link script; the
 * Members page list goes only to the space script, and the Clé d'alliance comes only from it; the game's pages ask
 * for the relève, the alliance's convoys and its floods.
 */
export function answer(
  service: ReturnType<typeof accountService>,
  message: AccountAction | LinkMessage | SpaceMessage | EnvoiMessage,
  from: ReturnType<typeof senderKind>,
): Promise<unknown> | null {
  if (message.type === "optizzz-space") {
    if (from !== "space") return null;
    switch (message.action) {
      case "members":
        return service.members(message.server);
      case "keys":
        return service.envois.receiveKeys({
          type: ALLIANCE_KEYS,
          spaceId: message.spaceId,
          keys: message.keys,
          expiresAt: message.expiresAt,
        });
      case "forget":
        return service.envois.forget().then(() => null);
    }
  }
  if (message.type === "optizzz-envois") {
    if (from !== "game") return null;
    switch (message.action) {
      case "page-open":
        return service.envois.releve("page").then(() => null);
      case "incoming":
        return service.envois.incoming(message.origin);
      case "floods":
        return service.envois.floods(message.origin);
      case "states":
        return service.envois.states(message.origin);
    }
  }
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
    case "choose":
      return service.choose(message);
  }
}

const RELEVE_ALARM = "optizzz-releve";

/** What a change in storage.local is about: the convoys kept for a server (« convoys:s5.fourmizzz.fr »…). */
const CONVOY_KEYS = /^(?:convoys|incomingConvoys|convoy-history):(s\d{1,2}\.fourmizzz\.fr)$/;
/** The attacks on their way as the game listed them, and those the Plan de flood noted, for a server. */
const FLOOD_KEYS = /^(?:sentAttacks:(s\d{1,2}\.fourmizzz\.fr)|flood:(s\d{1,2}\.fourmizzz\.fr):launches)$/;

/** The list category whose Envoi a change of this storage.local key calls for, with its game's host. */
export function changedCategory(key: string): { host: string; category: "convoys" | "floods" } | null {
  const convoys = CONVOY_KEYS.exec(key)?.[1];
  if (convoys) return { host: convoys, category: "convoys" };
  const floods = FLOOD_KEYS.exec(key);
  const host = floods?.[1] ?? floods?.[2];
  return host ? { host, category: "floods" } : null;
}

/** What the game's pages showed of the player's state, for a server (state-pages.ts): every state category's Envoi. */
const STATE_KEYS = /^envoiStates:(s\d{1,2}\.fourmizzz\.fr)$/;

/** The game's host whose states a change of this storage.local key calls for, if any. */
export const changedStates = (key: string): string | null => STATE_KEYS.exec(key)?.[1] ?? null;

/**
 * The account's background. `crypto` binds libsodium to a space's Clé d'alliance: the background's entrypoint passes
 * it in, the only file of the background allowed to import it (ADR 0007, eslint.config.js).
 */
export function setUpOptizzzAccount({
  crypto,
  notify,
}: {
  crypto: (keys: HandedKey[]) => EnvoiCrypto;
  notify: Parameters<typeof envoiService>[0]["notify"];
}): void {
  const permitted = () => browser.permissions.contains(SITE_PERMISSION);
  const envois = envoiService({
    now: () => new Date(),
    fetch: (url, init) => fetch(url, init),
    permitted,
    crypto,
    notify,
    later: (ms, run) => setTimeout(run, ms),
  });
  const service = accountService({
    now: () => new Date(),
    fetch: (url, init) => fetch(url, init),
    permitted,
    openConnectPage: () => browser.tabs.create({ url: browser.runtime.getURL(CONNECT_PAGE) }),
    envois,
  });

  // An Envoi a few seconds after a game page changed what is kept: never from the relève's alarm.
  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    for (const key of Object.keys(changes)) {
      const change = changedCategory(key);
      if (change) envois.changed(change.host, change.category);
      const states = changedStates(key);
      if (states) for (const category of STATE_CATEGORIES) envois.changed(states, category);
    }
  });
  // The relève, every 5 minutes: it reads optizzz.fr only, and nothing at all without a Clé d'alliance.
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name !== RELEVE_ALARM) return;
    envois.releve("alarm").catch((error: unknown) => {
      console.error("[Optizzz] the relève failed", error);
    });
  });
  void browser.alarms.get(RELEVE_ALARM).then((alarm) => {
    if (!alarm) void browser.alarms.create(RELEVE_ALARM, { periodInMinutes: RELEVE_MINUTES });
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
    if (!isAccountAction(message) && !isLinkMessage(message) && !isSpaceMessage(message) && !isEnvoiMessage(message))
      return false;
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
