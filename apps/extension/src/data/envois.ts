// What the extension keeps for the Envois (docs/features/site-envois.md). The choices of each Joueur, in storage.local:
// collect reads them to know what to keep. The Clé d'alliance, handed by the space page: storage.session for the
// browser's session (only the background reads it), storage.local until its date with « Se souvenir sur cet
// appareil ». The highest version seen per space stays, even after « Se déconnecter ». The site's answer about the
// spaces, what was last sent, and the relève (decrypted) in storage.session: forgotten when the browser closes.
import { NO_ENVOIS, type EnvoiChoices } from "@optizzz/game/site-links/envois";
import type { HandedKey } from "@optizzz/game/site-links/space-bridge";
import type { ConvoyItem } from "@optizzz/game/site-links/envoi-convoys";
import { storage } from "wxt/utils/storage";

const CHOICES_KEY = "local:optizzzAccount:envoiChoices";
const SESSION_KEYS = "session:optizzzAccount:allianceKeys";
const REMEMBERED_KEYS = "local:optizzzAccount:allianceKeys";
const VERSIONS_KEY = "local:optizzzAccount:keyVersions";
const SPACES_KEY = "local:optizzzAccount:spaces";
const SENT_KEY = "local:optizzzAccount:sent";
const RELEVE_KEY = "session:optizzzAccount:releve";

/** « s5:Pseudo », lower case: a Joueur. */
export const joueurKey = (server: string, pseudo: string) => `${server}:${pseudo.toLowerCase()}`;

// ── Choices

export async function loadChoices(server: string, pseudo: string): Promise<EnvoiChoices> {
  const all = (await storage.getItem<Record<string, Partial<EnvoiChoices>>>(CHOICES_KEY)) ?? {};
  return { ...NO_ENVOIS, ...all[joueurKey(server, pseudo)] };
}

/** Whether the game's logged-in player on this server sends their convoys: collect then keeps what they need. */
export async function sendsConvoys(origin: string, pseudo: string): Promise<boolean> {
  const server = /^(s\d{1,2})\.fourmizzz\.fr$/.exec(new URL(origin).host)?.[1];
  return server !== undefined && (await loadChoices(server, pseudo)).convoys;
}

export async function storeChoices(server: string, pseudo: string, choices: EnvoiChoices): Promise<void> {
  const all = (await storage.getItem<Record<string, EnvoiChoices>>(CHOICES_KEY)) ?? {};
  await storage.setItem(CHOICES_KEY, { ...all, [joueurKey(server, pseudo)]: choices });
}

// ── The Clé d'alliance

interface KeptKeys {
  keys: HandedKey[];
  /** Null: for the browser's session. */
  expiresAt: number | null;
}

type KeysBySpace = Partial<Record<string, KeptKeys>>;

/** Every version held for a space, or null (none, or past their date). */
export async function loadKeys(spaceId: string, now: Date): Promise<HandedKey[] | null> {
  const remembered = (await storage.getItem<KeysBySpace>(REMEMBERED_KEYS)) ?? {};
  const kept = remembered[spaceId];
  if (kept && kept.expiresAt !== null && kept.expiresAt <= now.getTime()) {
    await storage.setItem(REMEMBERED_KEYS, { ...remembered, [spaceId]: undefined });
  } else if (kept) return kept.keys;
  return (await storage.getItem<KeysBySpace>(SESSION_KEYS))?.[spaceId]?.keys ?? null;
}

/** Replaces the versions held for a space, for the session or until `expiresAt`. */
export async function storeKeys(spaceId: string, keys: HandedKey[], expiresAt: number | null): Promise<void> {
  const remembered = (await storage.getItem<KeysBySpace>(REMEMBERED_KEYS)) ?? {};
  const session = (await storage.getItem<KeysBySpace>(SESSION_KEYS)) ?? {};
  const kept: KeptKeys = { keys: keys.map(({ version, key }) => ({ version, key })), expiresAt };
  await storage.setItem(REMEMBERED_KEYS, { ...remembered, [spaceId]: expiresAt === null ? undefined : kept });
  await storage.setItem(SESSION_KEYS, { ...session, [spaceId]: expiresAt === null ? kept : undefined });
}

/** « Se déconnecter » (site or extension): no Clé d'alliance stays, nor anything read with it. */
export async function forgetKeys(): Promise<void> {
  await storage.removeItems([REMEMBERED_KEYS, SESSION_KEYS, RELEVE_KEY, SPACES_KEY, SENT_KEY]);
}

export async function seenVersion(spaceId: string): Promise<number> {
  return (await storage.getItem<Partial<Record<string, number>>>(VERSIONS_KEY))?.[spaceId] ?? 0;
}

export async function noteVersion(spaceId: string, version: number): Promise<void> {
  const all = (await storage.getItem<Partial<Record<string, number>>>(VERSIONS_KEY)) ?? {};
  if ((all[spaceId] ?? 0) < version) await storage.setItem(VERSIONS_KEY, { ...all, [spaceId]: version });
}

// ── The site's answer about the account's Players and their spaces (GET /api/extension/spaces)

export interface SpacePlayer {
  server: string;
  playerId: number;
  pseudo: string;
  categories: string[];
  space: {
    id: string;
    name: string;
    tag: string;
    version: { version: number; createdAt: string; createdByPseudo: string | null };
    members: { playerId: number; pseudo: string; categories: string[] }[];
  } | null;
}

export interface KeptSpaces {
  readAt: number;
  players: SpacePlayer[];
}

export const loadSpaces = () => storage.getItem<KeptSpaces>(SPACES_KEY);
export const storeSpaces = (spaces: KeptSpaces) => storage.setItem(SPACES_KEY, spaces);

// ── What was last sent, per Joueur: each fingerprint with its blob, to send the same blob again while the item
// does not change (the site then rewrites nothing, and the relève of the others carries nothing new).

export interface SentItem {
  digest: string;
  blob: string;
  keyVersion: number;
  kind: ConvoyItem["kind"];
  at: number;
  expiresAt: number;
}

export interface SentState {
  items: Partial<Record<string, SentItem>>;
  lastSentAt: number | null;
  /** Something changed that could not be sent (the site did not answer): sent again at the next game page. */
  pending: boolean;
  /** What stops the Envoi, to show in « Compte Optizzz ». */
  problem: string | null;
}

const EMPTY_SENT: SentState = { items: {}, lastSentAt: null, pending: false, problem: null };

export async function loadSent(joueur: string): Promise<SentState> {
  return (await storage.getItem<Partial<Record<string, SentState>>>(SENT_KEY))?.[joueur] ?? EMPTY_SENT;
}

export async function storeSent(joueur: string, state: SentState): Promise<void> {
  const all = (await storage.getItem<Partial<Record<string, SentState>>>(SENT_KEY)) ?? {};
  await storage.setItem(SENT_KEY, { ...all, [joueur]: state });
}

// ── The relève: each space's Envois, opened, with the cursor of the last relève.

export interface ReleveRow {
  playerId: number;
  fingerprint: string;
  observedAt: number;
  item: ConvoyItem;
}

export interface SpaceReleve {
  cursor: number;
  rows: Partial<Record<string, ReleveRow>>;
}

export async function loadReleve(spaceId: string): Promise<SpaceReleve | null> {
  return (await storage.getItem<Partial<Record<string, SpaceReleve>>>(RELEVE_KEY))?.[spaceId] ?? null;
}

export async function storeReleve(spaceId: string, releve: SpaceReleve): Promise<void> {
  const all = (await storage.getItem<Partial<Record<string, SpaceReleve>>>(RELEVE_KEY)) ?? {};
  await storage.setItem(RELEVE_KEY, { ...all, [spaceId]: releve });
}
