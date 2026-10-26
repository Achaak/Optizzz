// The Envois in the background script (docs/features/site-envois.md): it alone holds the Clé d'alliance the space page
// handed over, encrypts what a Joueur chose to send, and reads the space's Envois back (the relève) for the game's
// pages, which ask it what to show, already decrypted. The cipher (libsodium) is passed in by the background's
// entrypoint: nothing here imports it, so that the game's scripts never load it (ADR 0007).
//
// When an Envoi leaves: a few seconds after what the extension keeps for a checked category changes, with the whole
// category; at once when a category gets checked; again at the next game page after a failure. Never from a timer,
// never after a game read made for the site (docs/research/reglement.md). The relève reads optizzz.fr only, every 5
// minutes and when a game page opens, when the extension is linked, the Joueur in a space and the key held.
import { serverById } from "@optizzz/game/servers";
import { formatEndTime, formatEndTimeShort } from "@optizzz/game/format/time-format";
import { CONVOY_ITEM, convoyEnvoiItems, convoysToward, type ConvoyItem } from "@optizzz/game/site-links/envoi-convoys";
import {
  categoriesOf,
  newestPerFingerprint,
  openEnvoi,
  sealEnvoi,
  type EnvoiChoices,
  type EnvoiCrypto,
} from "@optizzz/game/site-links/envois";
import type { AllianceKeysMessage, HandedKey } from "@optizzz/game/site-links/space-bridge";
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
  storeSent,
  storeSpaces,
  type ReleveRow,
  type SentItem,
  type SentState,
  type SpacePlayer,
} from "@/data/envois";
import { forgetLink, loadAttachedPlayers, loadCurrentPlayer, loadLink } from "@/data/optizzz-account";
import { siteApi, type EnvoiBody } from "./api";
import type { DiscordService, DiscordStatus } from "./discord";

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

/** How long after a change of what the extension keeps the Envoi leaves: a page read often stores several things. */
export const ENVOI_DELAY_MS = 5_000;
/** The relève every 5 minutes (browser.alarms). */
export const RELEVE_MINUTES = 5;
/** A game page opening reads the site's spaces again at most this often. */
const PAGE_RELEVE_GAP_MS = 60_000;
const DAY = 24 * 3600_000;

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

export interface IncomingAnswer {
  /** Why nothing can be shown: not linked, not in a space, the key missing. Null when the list is read. */
  problem: "unlinked" | "no-space" | "no-key" | null;
  convoys: AllianceConvoyToMe[];
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

interface Dependencies {
  now: () => Date;
  fetch: Fetch;
  /** optizzz.fr granted (and, on Firefox, the consent to send data there). */
  permitted: () => Promise<boolean>;
  /** libsodium, bound to the versions of a space's Clé d'alliance. */
  crypto: (keys: HandedKey[]) => EnvoiCrypto;
  /** « Un convoi de Pseudo vous arrive à 18 h 12 », sent once per convoy, if switched on. */
  notify: (notice: { id: string; message: string; url: string }) => Promise<void>;
  /** A timer for the few seconds after a change (setTimeout): never a periodic send. */
  later: (ms: number, run: () => void) => void;
  /** The alliance's Discord webhook (discord.ts): told the news right after an Envoi. */
  discord: Pick<DiscordService, "refresh" | "announce" | "status" | "forget">;
}

const newestVersion = (keys: readonly HandedKey[]) => Math.max(0, ...keys.map((k) => k.version));

const originOf = (server: string) => serverById(server)?.origin ?? null;
const serverOfHost = (host: string) => /^(s\d{1,2})\.fourmizzz\.fr$/.exec(host)?.[1] ?? null;

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
    return players?.find((p) => p.server === server && p.pseudo.toLowerCase() === pseudo.toLowerCase()) ?? null;
  }

  /** The versions held for a space, if they are the newest seen (never a lower one: ADR 0005). */
  async function usableKeys(spaceId: string, announced: number): Promise<HandedKey[] | null> {
    const keys = await loadKeys(spaceId, now());
    if (!keys) return null;
    const held = newestVersion(keys);
    return held >= Math.max(announced, await seenVersion(spaceId)) ? keys : null;
  }

  async function setProblem(joueur: string, problem: string | null, pending = false) {
    const state = await loadSent(joueur);
    await storeSent(joueur, { ...state, problem, pending });
  }

  /**
   * Right after an Envoi of the convoys, Discord's news (docs/features/site-discord.md): the convoys the Joueur sent
   * that this Envoi carries for the first time, still on their way. Not on a first Envoi (what was already on its way
   * is not news), nor after a change of the Clé d'alliance (every fingerprint changes with it). Discord's answer never
   * blocks the Envoi.
   */
  async function announceConvoys(input: {
    token: string;
    spaceId: string;
    server: string;
    pseudo: string;
    previous: SentState;
    sent: SentState["items"];
    keyVersion: number;
    cipher: EnvoiCrypto;
  }): Promise<void> {
    const { previous, sent, pseudo } = input;
    const before = Object.values(previous.items).flatMap((item) => (item ? [item] : []));
    if (previous.lastSentAt === null || before.some((item) => item.keyVersion !== input.keyVersion)) return;
    const at = now().getTime();
    const news = Object.entries(sent).flatMap(([fingerprint, item]) => {
      if (!item || previous.items[fingerprint] || item.kind !== "transit" || item.at <= at) return [];
      const convoy = CONVOY_ITEM.safeParse(JSON.parse(item.digest));
      if (!convoy.success || convoy.data.from.toLowerCase() !== pseudo.toLowerCase()) return [];
      const { from, to, food, materials } = convoy.data;
      return [{ kind: "convoy" as const, from, to, food, materials, at: convoy.data.at }];
    });
    if (news.length === 0) return;
    try {
      await discord.announce({
        token: input.token,
        spaceId: input.spaceId,
        categories: categoriesOf(await loadChoices(input.server, pseudo)),
        crypto: input.cipher,
        event: "convoys",
        news,
      });
    } catch (error) {
      console.error("[Optizzz] Discord: the convoys could not be announced", error);
    }
  }

  /**
   * Sends a Joueur's convoys: every one the extension keeps (on its way both ways, delivered and received), each
   * encrypted, the same blob again for one that did not change, and the fingerprints gone since the last Envoi.
   */
  async function sendConvoys(server: string, pseudo: string): Promise<void> {
    const joueur = joueurKey(server, pseudo);
    const kept = await link();
    const origin = originOf(server);
    if (!kept || !origin || !(await loadChoices(server, pseudo)).convoys) return;
    const player = await spacePlayer(server, pseudo);
    if (!player?.space) return setProblem(joueur, NO_SPACE);
    const space = player.space;
    const keys = await usableKeys(space.id, space.version.version);
    if (!keys) return setProblem(joueur, MISSING_KEY);
    // What is kept for this server is the game's logged-in player: another Joueur's data never goes under this name.
    const current = await loadCurrentPlayer(origin);
    if (current?.toLowerCase() !== pseudo.toLowerCase()) return setProblem(joueur, OTHER_PLAYER);

    const [outgoing, incoming, history] = await Promise.all([
      loadConvoys(origin),
      loadIncomingConvoys(origin),
      loadConvoyHistory(origin),
    ]);
    const at = now();
    const cipher = crypto(keys);
    const keyVersion = newestVersion(keys);
    const previous = await loadSent(joueur);
    const items = convoyEnvoiItems({
      server,
      me: player.pseudo,
      outgoing: outgoing?.convoys ?? [],
      incoming: incoming?.convoys ?? [],
      history: history?.messages ?? [],
    });
    const readAt = (item: ConvoyItem) =>
      (item.kind === "transit" ? (incoming?.readAt ?? outgoing?.readAt) : history?.readAt)?.getTime() ?? at.getTime();

    const sent: SentState["items"] = {};
    for (const { identity, item, expiresAt } of items) {
      const fingerprint = await cipher.fingerprint(identity);
      const digest = JSON.stringify(item);
      const known = previous.items[fingerprint];
      const blob =
        known?.digest === digest && known.keyVersion === keyVersion
          ? known.blob
          : await sealEnvoi(
              {
                server,
                playerId: player.playerId,
                category: "convoys",
                fingerprint,
                observedAt: readAt(item),
                item,
              },
              cipher,
            );
      sent[fingerprint] = { digest, blob, keyVersion, kind: item.kind, at: item.at, expiresAt } satisfies SentItem;
    }
    // A delivery older than what the extension keeps stays on the site until its date: it is not « gone ».
    const forgottenHere = (item: SentItem) =>
      item.kind === "delivered" && item.at < at.getTime() - CONVOY_HISTORY_KEPT + DAY;
    const removed = Object.entries(previous.items)
      .filter(([fingerprint, item]) => item && !sent[fingerprint] && !forgottenHere(item))
      .map(([fingerprint]) => fingerprint);

    const body: EnvoiBody = {
      server,
      playerId: player.playerId,
      category: "convoys",
      keyVersion,
      items: Object.entries(sent).flatMap(([fingerprint, item]) =>
        item ? [{ fingerprint, blob: item.blob, expiresAt: item.expiresAt }] : [],
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
    if (result.ok) {
      await storeSent(joueur, { items: sent, lastSentAt: at.getTime(), pending: false, problem: null });
      await announceConvoys({
        token: kept.token,
        spaceId: space.id,
        server,
        pseudo,
        previous,
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
    await storeSent(joueur, {
      ...previous,
      pending: true,
      problem: result.error ? result.message : UNREACHABLE,
    });
  }

  /** What the extension keeps for a server changed (a game page was read): its Joueur's Envoi, a few seconds later. */
  function changed(host: string): void {
    const server = serverOfHost(host);
    if (!server || waiting.has(server)) return;
    waiting.add(server);
    later(ENVOI_DELAY_MS, () => {
      waiting.delete(server);
      void (async () => {
        const origin = originOf(server);
        const pseudo = origin ? await loadCurrentPlayer(origin) : null;
        const attached = await loadAttachedPlayers();
        if (!pseudo || !attached.some((p) => p.server === server && p.pseudo.toLowerCase() === pseudo.toLowerCase()))
          return;
        await sendConvoys(server, pseudo);
      })().catch((error: unknown) => {
        console.error("[Optizzz] Envoi: the convoys could not be sent", error);
      });
    });
  }

  /** « Convois » checked or unchecked in « Compte Optizzz »: the site is told; checked, what is known leaves at once. */
  async function choose(server: string, pseudo: string, choices: EnvoiChoices): Promise<void> {
    const before = await loadChoices(server, pseudo);
    await storeChoices(server, pseudo, choices);
    const kept = await link();
    if (!kept) return;
    const player = await spacePlayer(server, pseudo, true);
    if (player) await siteApi(kept.token, fetch).saveSettings(server, player.playerId, categoriesOf(choices));
    if (choices.convoys && !before.convoys) await sendConvoys(server, pseudo);
    if (!choices.convoys) await setProblem(joueurKey(server, pseudo), null);
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
      if (state.problem === MISSING_KEY || state.pending) await sendConvoys(player.server, player.pseudo);
    }
    return { ok: true };
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
      if (row.category !== "convoys") continue;
      try {
        const { observedAt, item } = await openEnvoi({ ...row, category: "convoys" }, cipher, CONVOY_ITEM);
        // The newest reading wins: an older one served again does not replace it.
        const known = rows[row.id];
        if (known && known.observedAt > observedAt) continue;
        const opened = { playerId: row.playerId, fingerprint: row.fingerprint, observedAt, item };
        if (!known) added.push(opened);
        rows[row.id] = opened;
      } catch {
        // Altered, filed under another row, or a version not held: left out.
      }
    }
    await storeReleve(spaceId, { cursor: answer.value.cursor, rows });
    // « Un convoi de Pseudo vous arrive à 18 h 12 », for a convoy newly seen on its way to one of the account's Joueurs.
    if (!previous) return;
    const at = now();
    for (const player of me) {
      const origin = originOf(player.server);
      if (!origin) continue;
      for (const row of convoysToward(
        player.pseudo,
        at,
        added.map((r) => ({ ...r.item, fingerprint: r.fingerprint })),
      )) {
        const arrival = new Date(row.at);
        const when =
          formatEndTimeShort(arrival, at) === formatEndTime(arrival, at)
            ? formatEndTime(arrival, at)
            : `à ${formatEndTimeShort(arrival, at)}`;
        await notify({
          id: `${new URL(origin).host}:alliance-convoy:${row.fingerprint}`,
          message: `${serverById(player.server)?.name ?? player.server} : un convoi de ${row.from} vous arrive ${when}`,
          url: `${origin}/commerce.php`,
        });
      }
    }
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
        if (state.pending) await sendConvoys(player.server, player.pseudo);
      }
    }
    const bySpace = new Map<string, SpacePlayer[]>();
    for (const player of players ?? [])
      if (player.space) bySpace.set(player.space.id, [...(bySpace.get(player.space.id) ?? []), player]);
    for (const [spaceId, members] of bySpace) {
      const keys = await loadKeys(spaceId, now());
      if (keys) await releveSpace(kept.token, spaceId, keys, members);
    }
  }

  /** commerce.php: the alliance's convoys on their way to the game's logged-in Joueur, from the last relève. */
  async function incoming(origin: string): Promise<IncomingAnswer> {
    const host = new URL(origin).host;
    const server = serverOfHost(host);
    const pseudo = await loadCurrentPlayer(origin);
    if (!server || !pseudo || !(await link())) return { problem: "unlinked", convoys: [] };
    const player = (await loadSpaces())?.players.find(
      (p) => p.server === server && p.pseudo.toLowerCase() === pseudo.toLowerCase(),
    );
    if (!player?.space) return { problem: "no-space", convoys: [] };
    const releveRows = await loadReleve(player.space.id);
    if (!releveRows || !(await loadKeys(player.space.id, now()))) return { problem: "no-key", convoys: [] };
    const rows = newestPerFingerprint(Object.values(releveRows.rows).flatMap((r) => (r ? [r] : [])));
    return {
      problem: null,
      convoys: convoysToward(
        pseudo,
        now(),
        rows.map((r) => r.item),
      ).map(({ from, food, materials, at }) => ({ from, food, materials, at })),
    };
  }

  /** Each attached Joueur's Envois, for « Compte Optizzz ». */
  async function status(): Promise<JoueurEnvois[]> {
    const attached = await loadAttachedPlayers();
    const players = (await loadSpaces())?.players ?? [];
    return Promise.all(
      attached.map(async ({ server, pseudo }) => {
        const choices = await loadChoices(server, pseudo);
        const space = players.find(
          (p) => p.server === server && p.pseudo.toLowerCase() === pseudo.toLowerCase(),
        )?.space;
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
    await discord.forget();
  }

  return { changed, choose, receiveKeys, forget, releve, incoming, status, refreshSpaces, sendConvoys };
}

export type EnvoiService = ReturnType<typeof envoiService>;
