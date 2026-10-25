// The rules of the Envois on the site (docs/features/site-envois.md). The site keeps what extensions encrypted with
// the Clé d'alliance and hands it to the members of the space: it checks who sends (a Player of the account, in a
// space, with the category checked), that the newest version of the key was used, and keeps no row past its date. It
// never reads an Envoi: the inside (Joueur, Serveur, catégorie, heure du relevé) is checked by whoever opens it.
import { isSentCategory } from "@optizzz/game/site-links/envois";
import type { EnvoiStore, ItemInput, PlayerRef } from "./store";

export class EnvoiError extends Error {
  override readonly name = "EnvoiError";
  constructor(
    readonly code: "invalid" | "forbidden" | "not-found" | "stale-key" | "category-off",
    message: string,
  ) {
    super(message);
  }
}

const DAY = 24 * 3600_000;
/** Nothing stays longer, whatever an extension says: 90 days after an arrival that may be a few days ahead. */
const LONGEST_KEPT = 100 * DAY;
/** A relève gives back this much: a write still committing as it reads is not missed (readers merge by id). */
const CURSOR_OVERLAP = 10_000;
const MAX_ITEMS = 2000;

/** The categories whose Envois are lists of items, and the setting that lets them go. */
const LIST_CATEGORIES = { convoys: "convoys" } as const;
type ListCategory = keyof typeof LIST_CATEGORIES;

const FINGERPRINT = /^[A-Za-z0-9_-]{22}$/;
/** Encrypted alliance data (ADR 0005, format 1): 45 bytes and more. */
const ALLIANCE_DATA = /^[A-Za-z0-9_-]{60,8000}$/;
const SPACE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const invalid = () => new EnvoiError("invalid", "Envoi refusé : il n'a pas la forme attendue.");
const STALE_KEY = () => new EnvoiError("stale-key", "Ouvrez votre espace sur optizzz.fr pour reprendre l'envoi.");

const record = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};

const isPlayerId = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value);

/** The key version an encrypted datum names in clear (bytes 1–4), or null when it is not format 1. */
export function blobKeyVersion(blob: string): number | null {
  const head = Buffer.from(blob.slice(0, 8), "base64url");
  return head.length >= 5 && head[0] === 1 ? head.readUInt32BE(1) : null;
}

export function envoiService(store: EnvoiStore, now: () => Date = () => new Date()) {
  async function ownPlayer(userId: string, player: PlayerRef) {
    const found = (await store.playersOf(userId)).find(
      (p) => p.server === player.server && p.playerId === player.playerId,
    );
    if (!found) throw new EnvoiError("forbidden", "Ce Joueur n'est pas rattaché à votre Compte Optizzz.");
    return found;
  }

  function playerRef(body: Record<string, unknown>): PlayerRef {
    if (typeof body.server !== "string" || !/^s\d{1,2}$/.test(body.server) || !isPlayerId(body.playerId))
      throw invalid();
    return { server: body.server, playerId: body.playerId };
  }

  return {
    /**
     * For the extension: each Player of the account, what it sends, its space with the newest version of the Clé
     * d'alliance (who made it and when) and what each member sends.
     */
    async spacesOf(userId: string) {
      const players = await store.playersOf(userId);
      return {
        players: await Promise.all(
          players.map(async (player) => {
            const spaceId = await store.spaceOf(player);
            const space = spaceId ? await store.space(spaceId) : null;
            const newest = space?.versions.at(-1);
            return {
              server: player.server,
              playerId: player.playerId,
              pseudo: player.pseudo,
              categories: await store.settingsOf(player),
              space:
                space && newest
                  ? {
                      id: space.id,
                      name: space.name,
                      tag: space.tag,
                      version: {
                        version: newest.version,
                        createdAt: newest.createdAt.toISOString(),
                        createdByPseudo: newest.createdByPseudo,
                      },
                      members: space.members.map((m) => ({
                        playerId: m.playerId,
                        pseudo: m.pseudo,
                        categories: m.categories,
                      })),
                    }
                  : null,
            };
          }),
        ),
      };
    },

    /** What a Joueur sends, chosen in their extension: shown on the space page. */
    async saveSettings(userId: string, input: unknown) {
      const body = record(input);
      const player = playerRef(body);
      const categories = body.categories;
      if (!Array.isArray(categories) || categories.length > 20 || !categories.every(isSentCategory)) throw invalid();
      await ownPlayer(userId, player);
      await store.saveSettings(player, [...new Set(categories)]);
    },

    /**
     * An Envoi of a list category: every item the extension knows (each encrypted with the newest version, its
     * fingerprint keyed with it too), and the fingerprints it no longer has.
     */
    async saveEnvoi(userId: string, input: unknown) {
      const body = record(input);
      const player = playerRef(body);
      const category = body.category;
      const keyVersion = body.keyVersion;
      if (typeof category !== "string" || !(category in LIST_CATEGORIES)) throw invalid();
      if (!isPlayerId(keyVersion) || keyVersion < 1) throw invalid();
      if (!Array.isArray(body.items) || body.items.length > MAX_ITEMS) throw invalid();
      if (!Array.isArray(body.removed) || body.removed.length > MAX_ITEMS) throw invalid();
      const removed = body.removed.map((f) => {
        if (typeof f !== "string" || !FINGERPRINT.test(f)) throw invalid();
        return f;
      });
      const at = now();
      const items: ItemInput[] = [];
      for (const raw of body.items as unknown[]) {
        const item = record(raw);
        const { fingerprint, blob, expiresAt } = item;
        if (typeof fingerprint !== "string" || !FINGERPRINT.test(fingerprint)) throw invalid();
        if (typeof blob !== "string" || !ALLIANCE_DATA.test(blob) || blobKeyVersion(blob) !== keyVersion)
          throw invalid();
        if (typeof expiresAt !== "number" || !Number.isFinite(expiresAt)) throw invalid();
        // Already past its date: not kept.
        if (expiresAt <= at.getTime()) continue;
        items.push({
          fingerprint,
          blob,
          keyVersion,
          expiresAt: new Date(Math.min(expiresAt, at.getTime() + LONGEST_KEPT)),
        });
      }

      await ownPlayer(userId, player);
      const spaceId = await store.spaceOf(player);
      const space = spaceId ? await store.space(spaceId) : null;
      if (!space) throw new EnvoiError("not-found", "Ce Joueur n'est dans aucun Espace d'alliance.");
      if (!(await store.settingsOf(player)).includes(LIST_CATEGORIES[category as ListCategory]))
        throw new EnvoiError("category-off", "Cette catégorie n'est pas cochée pour ce Joueur : rien n'est gardé.");
      const newest = Math.max(0, ...space.versions.map((v) => v.version));
      if (keyVersion !== newest) throw STALE_KEY();
      await store.writeItems(space.id, player, category, items, removed, at);
    },

    /**
     * The Envois of a space, for its members only (any member, whatever they send). With `since` (a cursor from an
     * earlier answer), only what was written after it, and the ids of the rows still there.
     */
    async readEnvois(userId: string, input: { spaceId: string; since?: number }) {
      if (!SPACE_ID.test(input.spaceId)) throw new EnvoiError("not-found", "Cet espace n'existe pas.");
      const space = await store.space(input.spaceId);
      if (!space) throw new EnvoiError("not-found", "Cet espace n'existe pas.");
      if (!space.members.some((m) => m.userId === userId))
        throw new EnvoiError("forbidden", "Vous n'êtes pas membre de cet espace.");
      const at = now();
      const since = input.since !== undefined && Number.isFinite(input.since) ? new Date(input.since) : undefined;
      const rows = await store.items(space.id, at, since);
      const newest = space.versions.at(-1);
      return {
        /** For « Accès changé le … par Pseudo (version N) ». */
        version: newest
          ? { version: newest.version, createdAt: newest.createdAt.getTime(), createdByPseudo: newest.createdByPseudo }
          : null,
        /** What each member sends, for « Envoie : convois ». */
        sends: space.members.map((m) => ({ playerId: m.playerId, pseudo: m.pseudo, categories: m.categories })),
        cursor: at.getTime() - CURSOR_OVERLAP,
        items: rows.map((r) => ({
          id: r.id,
          server: r.server,
          playerId: r.playerId,
          category: r.category,
          fingerprint: r.fingerprint,
          blob: r.blob,
        })),
        live: since ? await store.liveIds(space.id, at) : null,
      };
    },
  };
}

export type EnvoiSpaces = Awaited<ReturnType<ReturnType<typeof envoiService>["spacesOf"]>>;
