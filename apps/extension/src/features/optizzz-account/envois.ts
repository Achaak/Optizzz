// The Envois in the background script (docs/features/site-envois.md): it alone holds the Clé d'alliance the space page
// handed over, encrypts what a Joueur chose to send, and reads the space's Envois back (the relève) for the game's
// pages, which ask it what to show, already decrypted. The cipher (libsodium) is passed in by the background's
// entrypoint: nothing here imports it, so that the game's scripts never load it (ADR 0007).
//
// When an Envoi leaves: a few seconds after what the extension keeps for a checked category changes, with the whole
// category; at once when a category gets checked; again at the next game page after a failure. Never from a timer,
// never after a game read made for the site (docs/research/reglement.md). The relève reads optizzz.fr only, every 5
// minutes and when a game page opens, when the extension is linked, the Joueur in a space and the key held.
import { armyToKeys } from "@optizzz/game/army/units";
import { chainRolesFrom, type ChainRolesRecord } from "@optizzz/game/site-links/chain-roles";
import { serverById } from "@optizzz/game/servers";
import { formatEndTime, formatEndTimeShort } from "@optizzz/game/format/time-format";
import { CONVOY_ITEM, convoyEnvoiItems, convoysToward, type ConvoyItem } from "@optizzz/game/site-links/envoi-convoys";
import { huntEnvoiItems } from "@optizzz/game/site-links/envoi-hunts";
import { FLOOD_ITEM, floodEnvoiItems, floodsToward, type FloodItem } from "@optizzz/game/site-links/envoi-floods";
import {
  ARMY_UNITS,
  isStateCategory,
  nextStateItem,
  stateIdentity,
  stateItemSchema,
  STATE_CATEGORIES,
  STATES_KEPT_MS,
  type DatedItem,
  type StateCategory,
  type StateItem,
} from "@optizzz/game/site-links/envoi-states";
import {
  categoriesOf,
  isSent,
  newestPerFingerprint,
  openEnvoi,
  sealEnvoi,
  type EnvoiChoices,
  type EnvoiCrypto,
  type EnvoiRow,
} from "@optizzz/game/site-links/envois";
import type { AllianceKeysMessage, HandedKey } from "@optizzz/game/site-links/space-bridge";
import { loadAllianceMembers } from "@/data/alliance-members";
import { forgetChainRoles, loadChainRoles, storeChainRoles } from "@/data/chain-roles";
import { CONVOY_HISTORY_KEPT, loadConvoyHistory } from "@/data/convoy-history";
import { loadConvoys, loadIncomingConvoys } from "@/data/convoys";
import {
  forgetKeys,
  joueurKey,
  loadChoices,
  loadKeys,
  loadReleve,
  loadSent,
  loadSpaces,
  noteVersion,
  seenVersion,
  storeChoices,
  storeKeys,
  storeReleve,
  storeSpaces,
  updateSent,
  type ListCategory,
  type ReleveRow,
  type SentItem,
  type SentItems,
  type SentState,
  type SpacePlayer,
} from "@/data/envois";
import { loadLaunches } from "@/data/launches";
import { forgetLink, loadAttachedPlayers, loadCurrentPlayer, loadLink } from "@/data/optizzz-account";
import { loadSentAttacks } from "@/data/sent-attacks";
import { loadStatePages } from "@/data/state-pages";
import { pairLaunches } from "@/features/flood/attacks";
import { stateReading } from "./envoi-states";
import { DECLARED_CONVOY_CATEGORY, DEMANDE_CONVOY_ITEM } from "@optizzz/game/site-links/demandes";
import { loadDemandeConvoys } from "@/data/demandes";
import { demandeConvoyItems } from "./demande-convoys";
import { demandeService } from "./demandes";
import { siteApi, type EnvoiBody } from "./api";
import { attacksNews, type DiscordNews } from "@optizzz/game/site-links/discord";
import type { DiscordService, DiscordStatus } from "./discord";

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

/** How long after a change of what the extension keeps the Envoi leaves: a page read often stores several things. */
export const ENVOI_DELAY_MS = 5_000;
/** The relève every 5 minutes (browser.alarms). */
export const RELEVE_MINUTES = 5;
/** A game page opening reads the site's spaces again at most this often. */
const PAGE_RELEVE_GAP_MS = 60_000;
const DAY = 24 * 3600_000;

/** The categories, lists then states, in the order they leave. */
const LISTS: readonly ListCategory[] = ["convoys", "demande-convoys", "floods", "hunts-log", ...STATE_CATEGORIES];

export const MISSING_KEY = "Ouvrez votre espace sur optizzz.fr pour reprendre l'envoi.";
const NO_SPACE = "Pas encore dans un Espace d'alliance sur optizzz.fr : rien ne part.";
const UNREACHABLE = "optizzz.fr n'a pas répondu : l'envoi repartira à la prochaine page du jeu.";
const OTHER_PLAYER = "Le jeu ouvert dans ce navigateur est celui d'un autre Joueur : rien ne part pour celui-ci.";

/** A convoy of the alliance on its way to the player, for commerce.php and the notification. */
interface AllianceConvoyToMe {
  from: string;
  food: number;
  materials: number;
  /** Milliseconds since 1970. */
  at: number;
}

/** Why a game page shows nothing: not linked, not in a space, the key missing. Null when the list is read. */
type ReadProblem = "unlinked" | "no-space" | "no-key" | null;

export interface IncomingAnswer {
  problem: ReadProblem;
  convoys: AllianceConvoyToMe[];
}

/** The alliance's floods still on their way, for Armee.php, the Plan de flood and the targets. */
/**
 * The chain's roles for a game page (docs/features/site-chaine.md): those of the logged-in Joueur's space, opened, or
 * why there are none: `none` (no space, or a space without roles: the chain stays the player's), `no-key` (the space
 * has roles this extension cannot open: the local roles stay, with a note).
 */
export type ChainRolesAnswer =
  | { problem: "unlinked" | "no-space" | "none" | "no-key"; record?: undefined }
  | { problem: null; record: ChainRolesRecord; spaceId: string };

export interface FloodsAnswer {
  problem: ReadProblem;
  /** The game's logged-in Joueur. */
  me: string | null;
  /** The space's members, and the alliance's from the last Members page when it is the space's alliance. */
  members: string[];
  floods: FloodItem[];
}

/** The members' states sent to the space, for « Partage » (stateOfEnvoi turns each into shared states). */
export interface StatesAnswer {
  problem: ReadProblem;
  /** The space's alliance tag. */
  tag: string | null;
  rows: {
    category: StateCategory;
    observedAt: number;
    item: StateItem;
    /** The army by unit: for an Admin only. */
    units: Record<string, number> | null;
  }[];
}

/** One Joueur's Envois, for « Fonctionnalités » → « Compte Optizzz ». */
export interface JoueurEnvois {
  server: string;
  pseudo: string;
  choices: EnvoiChoices;
  spaceName: string | null;
  /** What stops the Envoi now, if anything. */
  problem: string | null;
  lastSentAt: number | null;
  /** What goes to the alliance's Discord for this Joueur, or null when the space announces nothing. */
  discord: DiscordStatus | null;
}

type NotificationKind = "alliance-convoy" | "alliance-flood";

interface Dependencies {
  now: () => Date;
  fetch: Fetch;
  /** optizzz.fr granted (and, on Firefox, the consent to send data there). */
  permitted: () => Promise<boolean>;
  /** libsodium, bound to the versions of a space's Clé d'alliance. */
  crypto: (keys: HandedKey[]) => EnvoiCrypto;
  /**
   * « Un convoi de Pseudo vous arrive à 18 h 12 », « Pseudo vous floode : arrivée aujourd'hui 18 h 12 », sent once
   * each, if switched on.
   */
  notify: (notice: { kind: NotificationKind; id: string; message: string; url: string }) => Promise<void>;
  /** A timer for the few seconds after a change (setTimeout): never a periodic send. */
  later: (ms: number, run: () => void) => void;
  /** The alliance's Discord webhook (discord.ts): told the news right after an Envoi. */
  discord: Pick<DiscordService, "refresh" | "announce" | "status" | "forget">;
}

/** One item of a list category, built from what the extension keeps. */
interface ListItem {
  identity: string;
  item: unknown;
  /** The Admins' blob's content (the army sent with a flood), or null. */
  detail: unknown;
  /** When the extension read it. */
  observedAt: number;
  kind?: string;
  at: number;
  expiresAt: number;
  /** Nothing about it can change any more (a flood arrived): what was sent stays as it was. */
  frozen: boolean;
  /** A state's reading and the one before it: kept with what was sent, and dated in its digest. */
  state?: DatedItem;
}

interface ListBuild {
  items: ListItem[];
  /** An item sent before and gone from what the extension keeps, that stays on the site until its date. */
  staysWhenGone: (item: SentItem) => boolean;
}

const newestVersion = (keys: readonly HandedKey[]) => Math.max(0, ...keys.map((k) => k.version));

const originOf = (server: string) => serverById(server)?.origin ?? null;
const serverOfHost = (host: string) => /^(s\d{1,2})\.fourmizzz\.fr$/.exec(host)?.[1] ?? null;
const sameName = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** « 18 h 12 » today, « demain 2 h 10 » otherwise, after « à » when it reads better. */
function arrivalWords(arrival: Date, now: Date): string {
  return formatEndTimeShort(arrival, now) === formatEndTime(arrival, now)
    ? formatEndTime(arrival, now)
    : `à ${formatEndTimeShort(arrival, now)}`;
}

/** The convoys the extension keeps for a Joueur: on their way both ways, delivered and received. */
async function convoyList(server: string, origin: string, me: string, at: Date): Promise<ListBuild> {
  const [outgoing, incoming, history] = await Promise.all([
    loadConvoys(origin),
    loadIncomingConvoys(origin),
    loadConvoyHistory(origin),
  ]);
  const readAt = (item: ConvoyItem) =>
    (item.kind === "transit" ? (incoming?.readAt ?? outgoing?.readAt) : history?.readAt)?.getTime() ?? at.getTime();
  const items = convoyEnvoiItems({
    server,
    me,
    outgoing: outgoing?.convoys ?? [],
    incoming: incoming?.convoys ?? [],
    history: history?.messages ?? [],
  }).map(({ identity, item, expiresAt }) => ({
    identity,
    item,
    detail: null,
    observedAt: readAt(item),
    kind: item.kind,
    at: item.at,
    expiresAt,
    frozen: false,
  }));
  return {
    items,
    // A delivery older than what the extension keeps stays on the site until its date: it is not « gone ».
    staysWhenGone: (item) => item.kind === "delivered" && item.at < at.getTime() - CONVOY_HISTORY_KEPT + DAY,
  };
}

/**
 * The attacks on their way the game last listed, each with the take and the army the Plan de flood noted when it
 * was sent (the noted launch arriving nearest on the same target), if any.
 */
async function floodList(server: string, origin: string, me: string, at: Date): Promise<ListBuild> {
  const [kept, launches] = await Promise.all([
    loadSentAttacks(origin),
    // Arrived ones too: an attack just arrived keeps its take until the next reading of the list.
    loadLaunches(origin, new Date(0)),
  ]);
  const attacks = kept?.attacks ?? [];
  const pairs = pairLaunches(launches, attacks);
  const items = floodEnvoiItems({
    server,
    me,
    attacks: attacks.map((attack, index) => {
      const launch = launches[pairs.get(index) ?? -1];
      return {
        ...attack,
        take: launch?.take ?? null,
        army: launch?.army ? armyToKeys(launch.army) : null,
      };
    }),
  }).map(({ identity, item, detail, expiresAt }) => ({
    identity,
    item,
    detail,
    observedAt: kept?.readAt.getTime() ?? at.getTime(),
    at: item.at,
    expiresAt,
    frozen: item.at <= at.getTime(),
  }));
  // A flood gone from the game's list before its arrival was cancelled; one arrived stays 7 days on the site.
  return { items, staysWhenGone: (item) => item.at <= at.getTime() };
}

/**
 * The hunts log: each hunt out that Ressources.php last listed, by the game's number for it, with the ants sent when
 * Compte+ lists them. Sent once and never sealed again (its countdown moves by a second from one reading to the next);
 * one gone from the list before its return was cancelled, one back stays on the site 90 days.
 */
async function huntsLogList(server: string, origin: string, me: string, at: Date): Promise<ListBuild> {
  const ressources = (await loadStatePages(origin)).ressources;
  const hunts = (ressources?.hunts ?? []).flatMap((hunt) =>
    hunt.id === undefined
      ? []
      : [
          {
            huntId: hunt.id,
            returnsAt: new Date(hunt.returnsAt),
            fieldGain: hunt.fieldGain,
            ants: hunt.troops ? Object.values(hunt.troops).reduce((sum, count) => sum + count, 0) : null,
          },
        ],
  );
  const items = huntEnvoiItems({ server, me, hunts }).map(({ identity, item, expiresAt }) => ({
    identity,
    item,
    detail: null,
    observedAt: ressources?.readAt ?? at.getTime(),
    at: item.returnsAt,
    expiresAt,
    frozen: true,
  }));
  return { items, staysWhenGone: (item) => item.at <= at.getTime() };
}

/**
 * A state of a Joueur, one row: its reading from what the game's pages showed, with the one sent before as its
 * previous (nextStateItem); the army by unit in the Admins' blob when « Par unité » is chosen. Nothing while a page it
 * needs was never read: what the site has stays.
 */
function stateList(category: StateCategory) {
  return async (server: string, origin: string, me: string, at: Date, previous: SentItems): Promise<ListBuild> => {
    const read = stateReading(category, await loadStatePages(origin), at);
    if (!read) return { items: [], staysWhenGone: () => true };
    const last = Object.values(previous).find((item) => item?.state)?.state ?? null;
    const next = nextStateItem(me, read.reading, read.observedAt, last);
    const units = category === "army" && (await loadChoices(server, me)).army === "units" ? read.units : undefined;
    return {
      items: [
        {
          identity: [stateIdentity(server, category), me.toLowerCase()].join("|"),
          item: next.item,
          detail: units ? { units } : null,
          observedAt: next.observedAt,
          at: next.observedAt,
          expiresAt: next.observedAt + STATES_KEPT_MS,
          frozen: false,
          state: next,
        },
      ],
      // A row under another fingerprint (another version of the key) is replaced, never kept twice.
      staysWhenGone: () => false,
    };
  };
}

/**
 * The convoys launched for a Demande (docs/features/site-demandes.md): one gone from the game's list before its
 * arrival was cancelled; one arrived stays as it was sent until its date.
 */
async function demandeConvoyList(server: string, origin: string, me: string, at: Date): Promise<ListBuild> {
  const items = demandeConvoyItems(server, me, await loadDemandeConvoys(origin)).map(
    ({ identity, item, expiresAt }) => ({
      identity,
      item,
      detail: null,
      observedAt: at.getTime(),
      at: item.at,
      expiresAt,
      frozen: item.at <= at.getTime(),
    }),
  );
  return { items, staysWhenGone: (item) => item.at <= at.getTime() };
}

type Builder = (server: string, origin: string, me: string, at: Date, previous: SentItems) => Promise<ListBuild>;

const LIST_BUILDERS: Record<ListCategory, Builder> = {
  convoys: convoyList,
  "demande-convoys": demandeConvoyList,
  floods: floodList,
  "hunts-log": huntsLogList,
  production: stateList("production"),
  hunts: stateList("hunts"),
  army: stateList("army"),
  levels: stateList("levels"),
};

/**
 * A row of the relève, opened, or null for a category the game's pages do not show. The army sent with a flood (the
 * Admins' blob) is not shown in the game: it is never opened here. Throws EnvoiRefused.
 */
async function openRow(
  row: {
    server: string;
    playerId: number;
    category: string;
    fingerprint: string;
    blob: string;
    detail?: string | null;
  },
  cipher: EnvoiCrypto,
): Promise<ReleveRow | null> {
  const base = { playerId: row.playerId, fingerprint: row.fingerprint };
  if (isStateCategory(row.category)) {
    const filed = { ...row, category: row.category };
    const { observedAt, item } = await openEnvoi(filed, cipher, stateItemSchema(row.category));
    // The army by unit comes to an Admin only; one that does not name this row is left out.
    const units =
      row.category === "army" && row.detail
        ? await openEnvoi({ ...filed, blob: row.detail }, cipher, ARMY_UNITS).then(
            (opened) => opened.item.units,
            () => null,
          )
        : null;
    return { ...base, observedAt, category: row.category, item, units };
  }
  if (row.category === "convoys") {
    const { observedAt, item } = await openEnvoi({ ...row, category: "convoys" }, cipher, CONVOY_ITEM);
    return { ...base, observedAt, category: "convoys", item };
  }
  if (row.category === "floods") {
    const { observedAt, item } = await openEnvoi({ ...row, category: "floods" }, cipher, FLOOD_ITEM);
    return { ...base, observedAt, category: "floods", item };
  }
  // A convoy declared on the site counts for its Demande as one attached from the game.
  const { category } = row;
  if (category === "demande-convoys" || category === DECLARED_CONVOY_CATEGORY) {
    const filed: EnvoiRow = { ...row, category };
    const { observedAt, item } = await openEnvoi(filed, cipher, DEMANDE_CONVOY_ITEM);
    return { ...base, observedAt, category: "demande-convoys", item };
  }
  return null;
}

export function envoiService({ now, fetch, permitted, crypto, notify, later, discord }: Dependencies) {
  let lastPageReleve = 0;
  const waiting = new Set<string>();

  async function link() {
    const kept = await loadLink();
    return kept && (await permitted()) ? kept : null;
  }

  /** The token was removed from /account: the extension forgets it, and the Clé d'alliance with it. */
  async function unlinked() {
    await forgetLink();
    await forgetKeys();
  }

  /** The Demandes (demandes.ts): their relève, and what the game's pages ask of them. */
  const demandes = demandeService({ now, fetch, crypto, link, unlinked });

  /** GET /api/extension/spaces, kept; the newest version of each space is remembered as seen. */
  async function refreshSpaces(): Promise<SpacePlayer[] | null> {
    const kept = await link();
    if (!kept) return null;
    const answer = await siteApi(kept.token, fetch).spaces();
    if (!answer.ok) {
      if (answer.unlinked) await unlinked();
      return (await loadSpaces())?.players ?? null;
    }
    await storeSpaces({ readAt: now().getTime(), players: answer.value.players });
    for (const player of answer.value.players)
      if (player.space) await noteVersion(player.space.id, player.space.version.version);
    if (answer.value.players.some((p) => p.space)) await discord.refresh(kept.token);
    return answer.value.players;
  }

  async function spacePlayer(server: string, pseudo: string, refresh = false): Promise<SpacePlayer | null> {
    const players = refresh ? await refreshSpaces() : ((await loadSpaces())?.players ?? (await refreshSpaces()));
    return players?.find((p) => p.server === server && sameName(p.pseudo, pseudo)) ?? null;
  }

  /** The versions held for a space, if they are the newest seen (never a lower one: ADR 0005). */
  async function usableKeys(spaceId: string, announced: number): Promise<HandedKey[] | null> {
    const keys = await loadKeys(spaceId, now());
    if (!keys) return null;
    const held = newestVersion(keys);
    return held >= Math.max(announced, await seenVersion(spaceId)) ? keys : null;
  }

  async function setProblem(joueur: string, problem: string | null, retry?: ListCategory[]) {
    await updateSent(joueur, (state) => ({ ...state, problem, ...(retry && { retry }) }));
  }

  /**
   * Right after an Envoi of a list category, Discord's news (docs/features/site-discord.md): what the Joueur did that
   * this Envoi carries for the first time, still to come (a convoy on its way, an attack not arrived). Not on the first
   * Envoi of the category (what was already on its way is not news), nor after a change of the Clé d'alliance (every
   * fingerprint changes with it). Discord's answer never blocks the Envoi.
   */
  async function announceList(input: {
    category: ListCategory;
    token: string;
    spaceId: string;
    server: string;
    pseudo: string;
    previous: SentItems | undefined;
    sent: SentItems;
    keyVersion: number;
    cipher: EnvoiCrypto;
  }): Promise<void> {
    const { previous, sent, pseudo, category } = input;
    // Discord announces convoys and floods only: a state (production, hunts, army, levels) is never news there.
    if (category !== "convoys" && category !== "floods") return;
    if (!previous || Object.values(previous).some((item) => item && item.keyVersion !== input.keyVersion)) return;
    const at = now().getTime();
    const fresh = Object.entries(sent).flatMap(([fingerprint, item]) =>
      item && !previous[fingerprint] && item.at > at ? [item] : [],
    );
    // The item is the digest itself, or its first half when the flood has an Admins' blob (never read here).
    const itemOf = (item: SentItem): unknown => {
      const parsed: unknown = JSON.parse(item.digest);
      return Array.isArray(parsed) ? parsed[0] : parsed;
    };
    const mine = (from: string) => sameName(from, pseudo);
    const news: DiscordNews[] =
      category === "convoys"
        ? fresh.flatMap((item) => {
            const convoy = CONVOY_ITEM.safeParse(itemOf(item));
            if (!convoy.success || convoy.data.kind !== "transit" || !mine(convoy.data.from)) return [];
            const { from, to, food, materials } = convoy.data;
            return [{ kind: "convoy" as const, from, to, food, materials, at: convoy.data.at }];
          })
        : attacksNews(
            fresh.flatMap((item) => {
              const flood = FLOOD_ITEM.safeParse(itemOf(item));
              return flood.success && mine(flood.data.from) ? [flood.data] : [];
            }),
          );
    if (news.length === 0) return;
    try {
      await discord.announce({
        token: input.token,
        spaceId: input.spaceId,
        categories: categoriesOf(await loadChoices(input.server, pseudo)),
        crypto: input.cipher,
        event: category,
        news,
      });
    } catch (error) {
      console.error(`[Optizzz] Discord: the ${category} could not be announced`, error);
    }
  }

  /**
   * Sends a Joueur's list category: every item the extension keeps, each encrypted (and, for a flood of the Plan de
   * flood, the army in the Admins' blob), the same blobs again for one that did not change, and the fingerprints gone
   * since the last Envoi.
   */
  async function sendList(server: string, pseudo: string, category: ListCategory): Promise<void> {
    const joueur = joueurKey(server, pseudo);
    const kept = await link();
    const origin = originOf(server);
    if (!kept || !origin || !isSent(await loadChoices(server, pseudo), category)) return;
    const player = await spacePlayer(server, pseudo);
    if (!player?.space) return setProblem(joueur, NO_SPACE);
    const space = player.space;
    const keys = await usableKeys(space.id, space.version.version);
    if (!keys) return setProblem(joueur, MISSING_KEY);
    // What is kept for this server is the game's logged-in player: another Joueur's data never goes under this name.
    const current = await loadCurrentPlayer(origin);
    if (current?.toLowerCase() !== pseudo.toLowerCase()) return setProblem(joueur, OTHER_PLAYER);

    const at = now();
    const cipher = crypto(keys);
    const keyVersion = newestVersion(keys);
    const previousState = await loadSent(joueur);
    const previous = previousState.lists[category] ?? {};
    const { items, staysWhenGone } = await LIST_BUILDERS[category](server, origin, player.pseudo, at, previous);

    const sent: SentItems = {};
    for (const listed of items) {
      const fingerprint = await cipher.fingerprint(listed.identity);
      const known = previous[fingerprint];
      if (listed.frozen && known) {
        // Sealed under an older version, it stays on the site as it is (left out, never « gone »).
        if (known.keyVersion === keyVersion) sent[fingerprint] = known;
        continue;
      }
      // The item alone when it has no Admins' blob: the digests of the convoys sent before ticket 21 still match.
      // A state is dated in its digest: one dated anew (STATE_REFRESH_MS) is sealed again.
      const digest = listed.state
        ? JSON.stringify([listed.observedAt, listed.item, listed.detail])
        : JSON.stringify(listed.detail === null ? listed.item : [listed.item, listed.detail]);
      if (known?.digest === digest && known.keyVersion === keyVersion) {
        sent[fingerprint] = known;
        continue;
      }
      const envelope = { server, playerId: player.playerId, category, fingerprint, observedAt: listed.observedAt };
      sent[fingerprint] = {
        digest,
        blob: await sealEnvoi({ ...envelope, item: listed.item }, cipher),
        detail: listed.detail === null ? null : await sealEnvoi({ ...envelope, item: listed.detail }, cipher),
        keyVersion,
        ...(listed.kind !== undefined && { kind: listed.kind }),
        at: listed.at,
        expiresAt: listed.expiresAt,
        ...(listed.state && { state: listed.state }),
      } satisfies SentItem;
    }
    const removed = Object.entries(previous)
      .filter(([fingerprint, item]) => item && !sent[fingerprint] && !staysWhenGone(item))
      .map(([fingerprint]) => fingerprint);
    // A state read again unchanged: the site already has it, nothing leaves (its pages are read at every game page).
    const unchanged =
      removed.length === 0 &&
      Object.keys(sent).length === Object.keys(previous).length &&
      Object.entries(sent).every(([fingerprint, item]) => previous[fingerprint] === item);
    // Nor the convoys attached to Demandes when none changed (most Joueurs never attach one), nor the hunts log when
    // no hunt left or was cancelled (Ressources.php is read again at every game page past 15 minutes).
    const quiet = isStateCategory(category) || category === "demande-convoys" || category === "hunts-log";
    if (quiet && unchanged && !previousState.retry.includes(category)) return;

    const body: EnvoiBody = {
      server,
      playerId: player.playerId,
      category,
      keyVersion,
      items: Object.entries(sent).flatMap(([fingerprint, item]) =>
        item
          ? [
              {
                fingerprint,
                blob: item.blob,
                ...(item.detail ? { detail: item.detail } : {}),
                expiresAt: item.expiresAt,
              },
            ]
          : [],
      ),
      removed,
    };
    const api = siteApi(kept.token, fetch);
    let result = await api.sendEnvoi(body);
    if (!result.ok && !result.unlinked && result.error === "category-off") {
      // The site did not get the choice (it was offline then): told again, and sent once more.
      await api.saveSettings(server, player.playerId, categoriesOf(await loadChoices(server, pseudo)));
      result = await api.sendEnvoi(body);
    }
    const others = (state: SentState) => state.retry.filter((c) => c !== category);
    if (result.ok) {
      await updateSent(joueur, (state) => {
        const retry = others(state);
        return {
          ...state,
          lists: { ...state.lists, [category]: sent },
          lastSentAt: at.getTime(),
          retry,
          problem: retry.length > 0 ? state.problem : null,
        };
      });
      await announceList({
        category,
        token: kept.token,
        spaceId: space.id,
        server,
        pseudo,
        previous: previousState.lists[category],
        sent,
        keyVersion,
        cipher,
      });
      return;
    }
    if (result.unlinked) return unlinked();
    if (result.error === "stale-key") {
      await refreshSpaces();
      return setProblem(joueur, MISSING_KEY);
    }
    await updateSent(joueur, (state) => ({
      ...state,
      retry: [...others(state), category],
      problem: result.error ? result.message : UNREACHABLE,
    }));
  }

  /** Every checked list category of a Joueur, one after the other. */
  async function sendLists(server: string, pseudo: string, only?: readonly ListCategory[]): Promise<void> {
    for (const category of only ?? LISTS) await sendList(server, pseudo, category);
  }

  /**
   * What the extension keeps for a category on a server changed (a game page was read): its Joueur's Envoi of that
   * category, a few seconds later.
   */
  function changed(host: string, category: ListCategory): void {
    const server = serverOfHost(host);
    const key = `${server ?? ""}|${category}`;
    if (!server || waiting.has(key)) return;
    waiting.add(key);
    later(ENVOI_DELAY_MS, () => {
      waiting.delete(key);
      void (async () => {
        const origin = originOf(server);
        const pseudo = origin ? await loadCurrentPlayer(origin) : null;
        const attached = await loadAttachedPlayers();
        if (!pseudo || !attached.some((p) => p.server === server && sameName(p.pseudo, pseudo))) return;
        await sendList(server, pseudo, category);
      })().catch((error: unknown) => {
        console.error(`[Optizzz] Envoi: the ${category} could not be sent`, error);
      });
    });
  }

  /** A category checked or unchecked in « Compte Optizzz »: the site is told; checked, what is known leaves at once. */
  async function choose(server: string, pseudo: string, choices: EnvoiChoices): Promise<void> {
    const before = await loadChoices(server, pseudo);
    await storeChoices(server, pseudo, choices);
    const kept = await link();
    if (!kept) return;
    const player = await spacePlayer(server, pseudo, true);
    if (player) await siteApi(kept.token, fetch).saveSettings(server, player.playerId, categoriesOf(choices));
    // Newly sent, or the army switched between « Nombre » and « Par unité ».
    const start = LISTS.filter(
      (category) =>
        isSent(choices, category) &&
        (!isSent(before, category) || (category === "army" && choices.army !== before.army)),
    );
    // A state unchecked went from the site with its choice: checked again, it leaves in full.
    const joueur = joueurKey(server, pseudo);
    const forgotten = STATE_CATEGORIES.filter((category) => !isSent(choices, category) || start.includes(category));
    await updateSent(joueur, (state) =>
      forgotten.some((category) => state.lists[category])
        ? {
            ...state,
            lists: Object.fromEntries(
              Object.entries(state.lists).filter(([category]) => !forgotten.includes(category as StateCategory)),
            ),
          }
        : state,
    );
    await sendLists(server, pseudo, start);
    if (!LISTS.some((category) => isSent(choices, category))) await setProblem(joueur, null, []);
  }

  /** The space page handed over the Clé d'alliance: kept, unless older than a version already seen. */
  async function receiveKeys(message: AllianceKeysMessage): Promise<{ ok: boolean }> {
    if (!(await loadLink())) return { ok: false };
    const held = newestVersion(message.keys);
    if (held < (await seenVersion(message.spaceId))) return { ok: false };
    await storeKeys(message.spaceId, message.keys, message.expiresAt);
    await noteVersion(message.spaceId, held);
    // Waiting for the key: what is kept leaves now.
    const players = (await loadSpaces())?.players ?? [];
    for (const player of players) {
      if (player.space?.id !== message.spaceId) continue;
      const state = await loadSent(joueurKey(player.server, player.pseudo));
      if (state.problem === MISSING_KEY || state.retry.length > 0) await sendLists(player.server, player.pseudo);
    }
    return { ok: true };
  }

  /** « Un convoi de Pseudo vous arrive à 18 h 12 », « Pseudo vous floode : arrivée aujourd'hui 18 h 12 ». */
  async function notifyNew(added: readonly ReleveRow[], me: readonly SpacePlayer[]): Promise<void> {
    const at = now();
    const convoys = added.flatMap((r) => (r.category === "convoys" ? [{ ...r.item, fingerprint: r.fingerprint }] : []));
    const floods = added.flatMap((r) => (r.category === "floods" ? [{ ...r.item, fingerprint: r.fingerprint }] : []));
    for (const player of me) {
      const origin = originOf(player.server);
      if (!origin) continue;
      const host = new URL(origin).host;
      const serverName = serverById(player.server)?.name ?? player.server;
      for (const row of convoysToward(player.pseudo, at, convoys)) {
        await notify({
          kind: "alliance-convoy",
          id: `${host}:alliance-convoy:${row.fingerprint}`,
          message: `${serverName} : un convoi de ${row.from} vous arrive ${arrivalWords(new Date(row.at), at)}`,
          url: `${origin}/commerce.php`,
        });
      }
      for (const row of floodsToward(player.pseudo, at, floods)) {
        await notify({
          kind: "alliance-flood",
          id: `${host}:alliance-flood:${row.fingerprint}`,
          message: `${row.from} vous floode : arrivée ${formatEndTime(new Date(row.at), at)} (${serverName})`,
          url: `${origin}/Armee.php`,
        });
      }
    }
  }

  /** Reads a space's Envois written since the last relève, opens them, and keeps what still exists. */
  async function releveSpace(token: string, spaceId: string, keys: HandedKey[], me: SpacePlayer[]): Promise<void> {
    const previous = await loadReleve(spaceId);
    const answer = await siteApi(token, fetch).readEnvois(spaceId, previous?.cursor ?? null);
    if (!answer.ok) {
      if (answer.unlinked) await unlinked();
      return;
    }
    const cipher = crypto(keys);
    // Without `live` (a first relève), everything comes again; with it, only the rows still on the site stay.
    const live = answer.value.live ? new Set(answer.value.live) : null;
    const rows: Partial<Record<string, ReleveRow>> =
      previous && live ? Object.fromEntries(Object.entries(previous.rows).filter(([id]) => live.has(id))) : {};
    const added: ReleveRow[] = [];
    for (const row of answer.value.items) {
      try {
        const opened = await openRow(row, cipher);
        if (!opened) continue;
        // The newest reading wins: an older one served again does not replace it.
        const known = rows[row.id];
        if (known && known.observedAt > opened.observedAt) continue;
        if (!known) added.push(opened);
        rows[row.id] = opened;
      } catch {
        // Altered, filed under another row, or a version not held: left out.
      }
    }
    await storeReleve(spaceId, { cursor: answer.value.cursor, rows });
    // Nothing is announced at the first relève: what was already on its way is not news.
    if (previous) await notifyNew(added, me);
  }

  /** The chain's roles of the account's spaces, kept encrypted (docs/features/site-chaine.md). */
  async function releveChainRoles(token: string): Promise<void> {
    const answer = await siteApi(token, fetch).chainRoles();
    if (answer.ok) await storeChainRoles(answer.value.spaces);
    else if (answer.unlinked) await unlinked();
  }

  /**
   * The relève: every 5 minutes (`alarm`) and when a game page opens (`page`, which also reads the spaces again and
   * sends what could not leave). Only optizzz.fr is read, never the game.
   */
  async function releve(reason: "alarm" | "page"): Promise<void> {
    const kept = await link();
    if (!kept) return;
    let players = (await loadSpaces())?.players ?? null;
    if (reason === "page" && now().getTime() - lastPageReleve >= PAGE_RELEVE_GAP_MS) {
      lastPageReleve = now().getTime();
      players = await refreshSpaces();
      for (const player of players ?? []) {
        const state = await loadSent(joueurKey(player.server, player.pseudo));
        if (state.retry.length > 0) await sendLists(player.server, player.pseudo, state.retry);
      }
    }
    const bySpace = new Map<string, SpacePlayer[]>();
    for (const player of players ?? [])
      if (player.space) bySpace.set(player.space.id, [...(bySpace.get(player.space.id) ?? []), player]);
    let opened = false;
    for (const [spaceId, members] of bySpace) {
      const keys = await loadKeys(spaceId, now());
      if (!keys) continue;
      opened = true;
      await releveSpace(kept.token, spaceId, keys, members);
      await demandes.releve(kept.token, spaceId, keys);
    }
    if (opened) await releveChainRoles(kept.token);
  }

  /** The game's logged-in Joueur on a server, their space and the rows of the last relève, or why there are none. */
  async function readRows(
    origin: string,
  ): Promise<
    { problem: Exclude<ReadProblem, null> } | { problem: null; pseudo: string; player: SpacePlayer; rows: ReleveRow[] }
  > {
    const server = serverOfHost(new URL(origin).host);
    const pseudo = await loadCurrentPlayer(origin);
    if (!server || !pseudo || !(await link())) return { problem: "unlinked" };
    const player = (await loadSpaces())?.players.find((p) => p.server === server && sameName(p.pseudo, pseudo));
    if (!player?.space) return { problem: "no-space" };
    const releveRows = await loadReleve(player.space.id);
    if (!releveRows || !(await loadKeys(player.space.id, now()))) return { problem: "no-key" };
    const rows = newestPerFingerprint(Object.values(releveRows.rows).flatMap((r) => (r ? [r] : [])));
    return { problem: null, pseudo, player, rows };
  }

  /** commerce.php: the alliance's convoys on their way to the game's logged-in Joueur, from the last relève. */
  async function incoming(origin: string): Promise<IncomingAnswer> {
    const read = await readRows(origin);
    if (read.problem !== null) return { problem: read.problem, convoys: [] };
    const convoys = read.rows.flatMap((r) => (r.category === "convoys" ? [r.item] : []));
    return {
      problem: null,
      convoys: convoysToward(read.pseudo, now(), convoys).map(({ from, food, materials, at }) => ({
        from,
        food,
        materials,
        at,
      })),
    };
  }

  /**
   * Armee.php, the Plan de flood and the targets: the members' floods still on their way, from the last relève, with
   * who the alliance's members are.
   */
  async function floods(origin: string): Promise<FloodsAnswer> {
    const read = await readRows(origin);
    if (read.problem !== null) return { problem: read.problem, me: null, members: [], floods: [] };
    const space = read.player.space;
    const list = await loadAllianceMembers(origin);
    const members = [
      ...(space?.members.map((m) => m.pseudo) ?? []),
      ...(list && space && list.tag?.toLowerCase() === space.tag.toLowerCase() ? list.pseudos : []),
    ];
    const at = now().getTime();
    return {
      problem: null,
      me: read.pseudo,
      members: [...new Map(members.map((m) => [m.toLowerCase(), m])).values()],
      floods: read.rows
        .flatMap((r) => (r.category === "floods" ? [r.item] : []))
        .filter((f) => f.at > at)
        .map(({ from, target, at: arrival, take }) => ({ from, target, at: arrival, take })),
    };
  }

  /**
   * « Partage »: the members' states from the last relève (each the latest reading and the one before it), the army
   * by unit for an Admin only, with the space's tag to check it is the alliance shown.
   */
  async function states(origin: string): Promise<StatesAnswer> {
    const read = await readRows(origin);
    if (read.problem !== null) return { problem: read.problem, tag: null, rows: [] };
    return {
      problem: null,
      tag: read.player.space?.tag ?? null,
      rows: read.rows.flatMap((r) =>
        r.category === "convoys" || r.category === "floods" || r.category === "demande-convoys"
          ? []
          : [{ category: r.category, observedAt: r.observedAt, item: r.item, units: r.units }],
      ),
    };
  }

  /** The chain's roles of the logged-in Joueur's space, opened with the Clé d'alliance held. */
  async function chainRoles(origin: string): Promise<ChainRolesAnswer> {
    const server = serverOfHost(new URL(origin).host);
    const pseudo = await loadCurrentPlayer(origin);
    if (!server || !pseudo || !(await link())) return { problem: "unlinked" };
    const player = (await loadSpaces())?.players.find((p) => p.server === server && sameName(p.pseudo, pseudo));
    if (!player?.space) return { problem: "no-space" };
    const kept = await loadChainRoles(player.space.id);
    if (!kept) return { problem: "none" };
    const keys = await usableKeys(player.space.id, player.space.version.version);
    if (!keys) return { problem: "no-key" };
    try {
      return {
        problem: null,
        record: chainRolesFrom(JSON.parse(await crypto(keys).decrypt(kept.blob)), player.space.id),
        spaceId: player.space.id,
      };
    } catch {
      // A version not held, or the roles of another space filed under this one.
      return { problem: "no-key" };
    }
  }

  /** Each attached Joueur's Envois, for « Compte Optizzz ». */
  async function status(): Promise<JoueurEnvois[]> {
    const attached = await loadAttachedPlayers();
    const players = (await loadSpaces())?.players ?? [];
    return Promise.all(
      attached.map(async ({ server, pseudo }) => {
        const choices = await loadChoices(server, pseudo);
        const space = players.find((p) => p.server === server && sameName(p.pseudo, pseudo))?.space;
        const state = await loadSent(joueurKey(server, pseudo));
        const categories = categoriesOf(choices);
        const sending = categories.length > 0;
        const keys = space ? await usableKeys(space.id, space.version.version) : null;
        const keyMissing = space !== undefined && space !== null && !keys;
        return {
          server,
          pseudo,
          choices,
          spaceName: space?.name ?? null,
          problem: !sending ? null : !space ? NO_SPACE : keyMissing ? MISSING_KEY : state.problem,
          lastSentAt: state.lastSentAt,
          discord: space && keys ? await discord.status({ spaceId: space.id, categories, crypto: crypto(keys) }) : null,
        };
      }),
    );
  }

  /** « Se déconnecter »: the Clé d'alliance goes, with what was read with it and the webhook it opened. */
  async function forget(): Promise<void> {
    await forgetKeys();
    await forgetChainRoles();
    await discord.forget();
  }

  return {
    changed,
    chainRoles,
    choose,
    receiveKeys,
    forget,
    releve,
    incoming,
    floods,
    states,
    status,
    refreshSpaces,
    sendList,
    demandes: demandes.demandes,
    prepareConvoy: demandes.prepareConvoy,
    levelsSeen: demandes.levelsSeen,
    attachLaunched: demandes.attach,
  };
}

export type EnvoiService = ReturnType<typeof envoiService>;
