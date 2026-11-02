// The rules of the Envois on the site (docs/features/site-envois.md). The site keeps what extensions encrypted with
// the Clé d'alliance and hands it to the members of the space: it checks who sends (a Player of the account, in a
// space, with the category checked), that the newest version of the key was used, and keeps no row past its date. It
// never reads an Envoi: the inside (Joueur, Serveur, catégorie, heure du relevé) is checked by whoever opens it.
import { isSentCategory } from "@optizzz/game/site-links/envois";
import type { ReminderKind } from "~/lib/spaces/reminders";
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
/** A relève gives back this much: a write still committing as it reads is not missed (readers merge by id). */
const CURSOR_OVERLAP = 10_000;
const MAX_ITEMS = 2000;

interface CategoryRules {
  /** The settings that let it go: any of them; none for an explicit act on the space page. */
  settings: readonly string[];
  /** How long a row may stay at most, whatever an extension says. */
  longest: number;
  /** The setting that lets an item carry a blob for the Admins only; null when it never does. */
  detail: string | null;
  /** A state is one row per Joueur (docs/features/site-envois.md, « Ce que garde le site »). */
  maxItems: number;
}

/**
 * The categories of the Envois: lists of items (convoys, floods) and states, one row per Joueur holding the latest
 * reading and the one before it (production, hunts, army, levels).
 */
const CATEGORIES = {
  // 90 days after an arrival that may be a few days ahead.
  convoys: { settings: ["convoys"], longest: 100 * DAY, detail: null, maxItems: MAX_ITEMS },
  // 7 days after an arrival at most 30 days ahead (the longest trip the flood plan notes), and the army sent.
  floods: { settings: ["floods"], longest: 40 * DAY, detail: "floods", maxItems: MAX_ITEMS },
  // A state not sent again for 90 days goes; the army by unit only while « Par unité » is chosen.
  production: { settings: ["production"], longest: 100 * DAY, detail: null, maxItems: 1 },
  hunts: { settings: ["hunts"], longest: 100 * DAY, detail: null, maxItems: 1 },
  army: { settings: ["army-count", "army-units"], longest: 100 * DAY, detail: "army-units", maxItems: 1 },
  levels: { settings: ["levels"], longest: 100 * DAY, detail: null, maxItems: 1 },
  // The convoys launched for a Demande (docs/features/site-demandes.md): with « Convois », 90 days after the arrival.
  "demande-convoys": { settings: ["convoys"], longest: 100 * DAY, detail: null, maxItems: MAX_ITEMS },
  // A convoy its sender declares for a Demande on the space page: an explicit act, without a setting.
  "declared-convoys": { settings: [], longest: 100 * DAY, detail: null, maxItems: MAX_ITEMS },
} satisfies Record<string, CategoryRules>;

/** The states, whose row goes as soon as their category is unchecked. */
const STATES = ["production", "hunts", "army", "levels"] as const;

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
function blobKeyVersion(blob: string): number | null {
  const head = Buffer.from(blob.slice(0, 8), "base64url");
  return head.length >= 5 && head[0] === 1 ? head.readUInt32BE(1) : null;
}

/**
 * Asks for the site's reminder on Discord (src/server/reminders/service.ts): it posts later, if an Admin switched the
 * kind on, and never fails an Envoi.
 */
type Remind = (spaceId: string, kind: ReminderKind) => void;

export function envoiService(store: EnvoiStore, now: () => Date = () => new Date(), remind: Remind = () => undefined) {
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
      // A state unchecked goes from the site at once, and the army by unit when « Par unité » is no longer chosen.
      const chosen: readonly string[] = categories;
      const checked = (rules: CategoryRules) => rules.settings.some((setting) => chosen.includes(setting));
      await store.forgetStates(
        player,
        STATES.filter((category) => !checked(CATEGORIES[category])),
        STATES.filter((category) => {
          const rules: CategoryRules = CATEGORIES[category];
          return rules.detail !== null && !chosen.includes(rules.detail);
        }),
        now(),
      );
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
      const rules: CategoryRules | null =
        typeof category === "string" && Object.hasOwn(CATEGORIES, category)
          ? CATEGORIES[category as keyof typeof CATEGORIES]
          : null;
      if (typeof category !== "string" || !rules) throw invalid();
      if (!isPlayerId(keyVersion) || keyVersion < 1) throw invalid();
      if (!Array.isArray(body.items) || body.items.length > rules.maxItems) throw invalid();
      if (!Array.isArray(body.removed) || body.removed.length > MAX_ITEMS) throw invalid();
      const removed = body.removed.map((f) => {
        if (typeof f !== "string" || !FINGERPRINT.test(f)) throw invalid();
        return f;
      });
      const at = now();
      const items: ItemInput[] = [];
      for (const raw of body.items as unknown[]) {
        const item = record(raw);
        const { fingerprint, blob, detail = null, expiresAt } = item;
        const sealed = (value: unknown) =>
          typeof value === "string" && ALLIANCE_DATA.test(value) && blobKeyVersion(value) === keyVersion;
        if (typeof fingerprint !== "string" || !FINGERPRINT.test(fingerprint)) throw invalid();
        if (typeof blob !== "string" || !sealed(blob)) throw invalid();
        if (detail !== null && (rules.detail === null || typeof detail !== "string" || !sealed(detail)))
          throw invalid();
        if (typeof expiresAt !== "number" || !Number.isFinite(expiresAt)) throw invalid();
        // Already past its date: not kept.
        if (expiresAt <= at.getTime()) continue;
        items.push({
          fingerprint,
          blob,
          detail,
          keyVersion,
          expiresAt: new Date(Math.min(expiresAt, at.getTime() + rules.longest)),
        });
      }

      await ownPlayer(userId, player);
      const spaceId = await store.spaceOf(player);
      const space = spaceId ? await store.space(spaceId) : null;
      if (!space) throw new EnvoiError("not-found", "Ce Joueur n'est dans aucun Espace d'alliance.");
      const settings = await store.settingsOf(player);
      if (rules.settings.length > 0 && !rules.settings.some((setting) => settings.includes(setting)))
        throw new EnvoiError("category-off", "Cette catégorie n'est pas cochée pour ce Joueur : rien n'est gardé.");
      // The army by unit while « Par unité » is not chosen (the site did not get the choice yet): the extension is
      // told the category is off, and tells it again.
      if (rules.detail !== null && items.some((i) => i.detail !== null) && !settings.includes(rules.detail))
        throw new EnvoiError("category-off", "« Par unité » n'est pas choisi pour ce Joueur : rien n'est gardé.");
      const newest = Math.max(0, ...space.versions.map((v) => v.version));
      if (keyVersion !== newest) throw STALE_KEY();
      const added = await store.writeItems(space.id, player, category, items, removed, at);
      // New flood rows: « Nouveaux floods sur l'espace … », content-free (docs/features/site-discord.md).
      if (category === "floods" && added > 0) remind(space.id, "floods");
    },

    /**
     * The Envois of a space, for its members only (any member, whatever they send). With `since` (a cursor from an
     * earlier answer), only what was written after it, and the ids of the rows still there. The Admins' blobs (the
     * army sent with a flood) go to the space's Admins only: reserved by the site, not by the encryption, since every
     * member holds the same Clé d'alliance (docs/features/site-envois.md, « Qui voit quoi »).
     */
    async readEnvois(userId: string, input: { spaceId: string; since?: number }) {
      if (!SPACE_ID.test(input.spaceId)) throw new EnvoiError("not-found", "Cet espace n'existe pas.");
      const space = await store.space(input.spaceId);
      if (!space) throw new EnvoiError("not-found", "Cet espace n'existe pas.");
      const reader = space.members.find((m) => m.userId === userId);
      if (!reader) throw new EnvoiError("forbidden", "Vous n'êtes pas membre de cet espace.");
      const admin = reader.role === "admin";
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
          detail: admin ? r.detail : null,
        })),
        live: since ? await store.liveIds(space.id, at) : null,
      };
    },
  };
}
