// What the extension keeps of its link to an Optizzz account (docs/features/optizzz-account.md). All in storage.local,
// never storage.sync: a token belongs to one browser. Only the background script and the extension's pages read the
// token; content scripts on the game never ask for it.
import { storage } from "wxt/utils/storage";

/** The link to the account: the token the site gave on /connect-extension. */
export interface AccountLink {
  token: string;
  linkedAt: number;
}

/** A Player of the account, as the site lists it. */
export interface AttachedPlayer {
  /** « s5 ». */
  server: string;
  pseudo: string;
}

const LINK_KEY = "local:optizzzAccount:link";
const LINK_REQUESTED_KEY = "local:optizzzAccount:linkRequestedAt";
const PLAYERS_KEY = "local:optizzzAccount:players";
const DECLINED_KEY = "local:optizzzAccount:declined";
const LAST_SERVER_KEY = "local:optizzzAccount:lastServer";
const playerKey = (origin: string) => `local:optizzzAccount:player:${new URL(origin).host}` as const;

/**
 * « Connecter mon Compte Optizzz » opens the site's page: its script may take a token only this long after the
 * click (time enough to sign in by a magic link on the way).
 */
export const LINK_REQUEST_TTL = 30 * 60_000;

export const loadLink = () => storage.getItem<AccountLink>(LINK_KEY);

export async function storeLink(token: string, now: Date): Promise<void> {
  await storage.setItem<AccountLink>(LINK_KEY, { token, linkedAt: now.getTime() });
  await storage.removeItem(LINK_REQUESTED_KEY);
}

/** Unlinked: the token and the account's Players are forgotten. Refusals and the game's pages stay. */
export async function forgetLink(): Promise<void> {
  await storage.removeItems([LINK_KEY, PLAYERS_KEY]);
}

export async function requestLink(now: Date): Promise<void> {
  await storage.setItem(LINK_REQUESTED_KEY, now.getTime());
}

/** Whether « Connecter mon Compte Optizzz » was clicked less than `LINK_REQUEST_TTL` ago. */
export async function isLinkRequested(now: Date): Promise<boolean> {
  const at = await storage.getItem<number>(LINK_REQUESTED_KEY);
  return at !== null && now.getTime() - at >= 0 && now.getTime() - at <= LINK_REQUEST_TTL;
}

export async function loadAttachedPlayers(): Promise<AttachedPlayer[]> {
  return (await storage.getItem<AttachedPlayer[]>(PLAYERS_KEY)) ?? [];
}

export async function storeAttachedPlayers(players: AttachedPlayer[]): Promise<void> {
  await storage.setItem(
    PLAYERS_KEY,
    players.map(({ server, pseudo }) => ({ server, pseudo })),
  );
}

/** « s5:Pseudo »: a refused offer, never made again for this Player. */
export const declinedKey = (server: string, pseudo: string) => `${server}:${pseudo}`;

export async function loadDeclined(): Promise<string[]> {
  return (await storage.getItem<string[]>(DECLINED_KEY)) ?? [];
}

export async function decline(server: string, pseudo: string): Promise<void> {
  const declined = new Set(await loadDeclined());
  declined.add(declinedKey(server, pseudo));
  await storage.setItem(DECLINED_KEY, [...declined]);
}

/** The pseudo of the game's header, kept by `collect` per server, and the server of the last game tab. */
export async function storeCurrentPlayer(origin: string, pseudo: string): Promise<void> {
  await storage.setItem(playerKey(origin), pseudo);
  await storage.setItem(LAST_SERVER_KEY, origin);
}

export const loadCurrentPlayer = (origin: string) => storage.getItem<string>(playerKey(origin));

export const loadLastGameServer = () => storage.getItem<string>(LAST_SERVER_KEY);
