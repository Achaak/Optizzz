// The rules of the Demandes on the site (docs/features/site-demandes.md). What a Demande asks for (building or
// research, levels, nourriture and matériaux) is encrypted with the Clé d'alliance in its requester's browser and
// sealed for its row: the site never reads it. It keeps in clear what its rules need: who asked and in which space, the
// status and who may change it (an Admin or a Délégué decides, the requester cancels and orders, their extension
// closes), the dates, and the pseudo of whoever decided. « Couverte » is not kept: every reader works it out from the
// convoys attached to the Demande.
import { DEMANDES_KEPT_MS, isDemandeId, OPEN_STATUSES, type DemandeStatus } from "@optizzz/game/site-links/demandes";
import type { ReminderKind } from "~/lib/spaces/reminders";
import type { PlayerRef } from "~/server/envois/store";
import type { DemandeRow, DemandeStore } from "./store";

export class DemandeError extends Error {
  override readonly name = "DemandeError";
  constructor(
    readonly code: "invalid" | "forbidden" | "not-found" | "stale-key" | "needs-envois" | "conflict",
    message: string,
  ) {
    super(message);
  }
}

/** A relève gives back this much: a write still committing as it reads is not missed (readers merge by id). */
const CURSOR_OVERLAP = 10_000;
/** Open Demandes a Joueur may have at once. */
const MAX_OPEN = 20;
/** Encrypted alliance data (ADR 0005, format 1): 45 bytes and more. */
const ALLIANCE_DATA = /^[A-Za-z0-9_-]{60,8000}$/;
const SPACE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
/** Making a Demande asks to send these (site-optizzz.md, « Envois »). */
const REQUIRED_ENVOIS = ["production", "convoys"];

const invalid = () => new DemandeError("invalid", "Demande refusée : elle n'a pas la forme attendue.");
const gone = () => new DemandeError("not-found", "Cette Demande n'existe plus.");
const moved = () =>
  new DemandeError("conflict", "Cette Demande a changé entre-temps : la page se met à jour, réessayez si besoin.");

const record = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};

const isPlayerId = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value);

/** The key version an encrypted datum names in clear (bytes 1–4), or null when it is not format 1. */
function blobKeyVersion(blob: string): number | null {
  const head = Buffer.from(blob.slice(0, 8), "base64url");
  return head.length >= 5 && head[0] === 1 ? head.readUInt32BE(1) : null;
}

const time = (date: Date | null) => (date ? date.getTime() : null);

/** A Demande as readers get it: dates in milliseconds, the content still encrypted. */
const served = (row: DemandeRow) => ({
  id: row.id,
  server: row.server,
  playerId: row.playerId,
  status: row.status,
  rank: row.rank,
  blob: row.blob,
  createdAt: row.createdAt.getTime(),
  decidedAt: time(row.decidedAt),
  decidedByPseudo: row.decidedByPseudo,
  endedAt: time(row.endedAt),
});

/**
 * Asks for the site's reminder on Discord (src/server/reminders/service.ts, docs/features/site-discord.md): it posts
 * later, content-free, if an Admin switched « Demandes à valider » on, and never fails a Demande.
 */
type Remind = (spaceId: string, kind: ReminderKind) => void;

export function demandeService(
  store: DemandeStore,
  now: () => Date = () => new Date(),
  remind: Remind = () => undefined,
) {
  function playerRef(body: Record<string, unknown>): PlayerRef {
    if (typeof body.server !== "string" || !/^s\d{1,2}$/.test(body.server) || !isPlayerId(body.playerId))
      throw invalid();
    return { server: body.server, playerId: body.playerId };
  }

  async function ownPlayer(userId: string, player: PlayerRef) {
    const found = (await store.playersOf(userId)).some(
      (p) => p.server === player.server && p.playerId === player.playerId,
    );
    if (!found) throw new DemandeError("forbidden", "Ce Joueur n'est pas rattaché à votre Compte Optizzz.");
  }

  /** The space of a Joueur of this account, with the Joueur as a member. */
  async function spaceOfPlayer(userId: string, player: PlayerRef) {
    await ownPlayer(userId, player);
    const spaceId = await store.spaceOf(player);
    const space = spaceId ? await store.space(spaceId) : null;
    if (!space) throw new DemandeError("not-found", "Ce Joueur n'est dans aucun Espace d'alliance.");
    return space;
  }

  /** A Demande, its space, and the member of this account in that space. */
  async function demandeFor(userId: string, input: unknown) {
    const id = record(input).id;
    if (!isDemandeId(id)) throw invalid();
    const demande = await store.demande(id, now());
    const space = demande ? await store.space(demande.spaceId) : null;
    if (!demande || !space) throw gone();
    const actor = space.members.find((m) => m.userId === userId);
    if (!actor) throw new DemandeError("forbidden", "Vous n'êtes pas membre de cet espace.");
    const mine = actor.server === demande.server && actor.playerId === demande.playerId;
    return { demande, space, actor, mine };
  }

  /** Finished: kept 90 days, then gone. */
  const ended = (at: Date) => ({ endedAt: at, expiresAt: new Date(at.getTime() + DEMANDES_KEPT_MS) });

  async function change(id: string, from: readonly DemandeStatus[], to: Parameters<DemandeStore["change"]>[2]) {
    if (!(await store.change(id, from, to, now()))) throw moved();
  }

  return {
    /**
     * A new Demande, à valider, last in its requester's order: its id drawn by the requester's browser, its content
     * sealed for it with the newest version of the Clé d'alliance. Its requester sends Production and Convois.
     */
    async create(userId: string, input: unknown) {
      const body = record(input);
      const player = playerRef(body);
      const { id, blob, keyVersion } = body;
      if (!isDemandeId(id) || !isPlayerId(keyVersion) || keyVersion < 1) throw invalid();
      if (typeof blob !== "string" || !ALLIANCE_DATA.test(blob) || blobKeyVersion(blob) !== keyVersion) throw invalid();
      const space = await spaceOfPlayer(userId, player);
      const settings = await store.settingsOf(player);
      if (!REQUIRED_ENVOIS.every((category) => settings.includes(category)))
        throw new DemandeError(
          "needs-envois",
          "Pour faire une Demande, envoyez d'abord Production et Convois depuis l'extension (Fonctionnalités › Compte Optizzz).",
        );
      const newest = Math.max(0, ...space.versions.map((v) => v.version));
      if (keyVersion !== newest)
        throw new DemandeError("stale-key", "L'accès à l'espace a changé : rechargez la page, puis réessayez.");
      const at = now();
      const open = (await store.demandes(space.id, at)).filter(
        (d) => d.server === player.server && d.playerId === player.playerId && OPEN_STATUSES.includes(d.status),
      );
      if (open.length >= MAX_OPEN)
        throw new DemandeError(
          "invalid",
          `Vous avez déjà ${String(MAX_OPEN)} Demandes ouvertes : annulez-en une avant d'en faire une autre.`,
        );
      const created = await store.create(
        {
          id,
          spaceId: space.id,
          ...player,
          status: "pending",
          blob,
          keyVersion,
          decidedAt: null,
          decidedByPseudo: null,
          endedAt: null,
        },
        at,
      );
      if (!created) throw invalid();
      // A new Demande waits to be validated: the only moment one becomes « à valider ».
      remind(space.id, "demands");
    },

    /**
     * An Admin or a Délégué validates or refuses a Demande à valider. An Admin may decide their own (a small alliance
     * with a single Admin needs no Délégué for it); a Délégué never decides theirs.
     */
    async decide(userId: string, input: unknown) {
      const decision = record(input).decision;
      if (decision !== "validated" && decision !== "refused") throw invalid();
      const { demande, actor, mine } = await demandeFor(userId, input);
      if (actor.role !== "admin" && actor.role !== "delegate")
        throw new DemandeError("forbidden", "Seuls un Admin ou un Délégué valident les Demandes.");
      if (mine && actor.role !== "admin")
        throw new DemandeError("forbidden", "Un Admin ou un autre Délégué doit décider de votre Demande.");
      const at = now();
      await change(demande.id, ["pending"], {
        status: decision,
        decidedAt: at,
        decidedByPseudo: actor.pseudo,
        ...(decision === "refused" && ended(at)),
      });
    },

    /** The requester cancels one of their open Demandes. */
    async cancel(userId: string, input: unknown) {
      const { demande, mine } = await demandeFor(userId, input);
      if (!mine) throw new DemandeError("forbidden", "Seul son demandeur annule une Demande.");
      await change(demande.id, OPEN_STATUSES, { status: "cancelled", ...ended(now()) });
    },

    /** The requester's order of their open Demandes: every one of them, first first. */
    async reorder(userId: string, input: unknown) {
      const body = record(input);
      const player = playerRef(body);
      const ids = body.ids;
      if (!Array.isArray(ids) || ids.length > MAX_OPEN || !ids.every(isDemandeId)) throw invalid();
      const space = await spaceOfPlayer(userId, player);
      const at = now();
      const open = (await store.demandes(space.id, at))
        .filter((d) => d.server === player.server && d.playerId === player.playerId && OPEN_STATUSES.includes(d.status))
        .map((d) => d.id);
      if (new Set(ids).size !== ids.length || ids.length !== open.length || !open.every((id) => ids.includes(id)))
        throw invalid();
      await store.reorder(ids, at);
    },

    /**
     * From the requester's extension, which saw the level reached or the work under way in the game: their open
     * Demandes among `ids` are closed. The others are left as they are (already closed, cancelled, or not theirs).
     */
    async close(userId: string, input: unknown): Promise<{ closed: string[] }> {
      const body = record(input);
      const player = playerRef(body);
      const ids = body.ids;
      if (!Array.isArray(ids) || ids.length > MAX_OPEN || !ids.every(isDemandeId)) throw invalid();
      const space = await spaceOfPlayer(userId, player);
      const at = now();
      const closed: string[] = [];
      for (const demande of await store.demandes(space.id, at)) {
        const theirs = demande.server === player.server && demande.playerId === player.playerId;
        if (!theirs || !ids.includes(demande.id) || !OPEN_STATUSES.includes(demande.status)) continue;
        if (await store.change(demande.id, OPEN_STATUSES, { status: "closed", ...ended(at) }, at))
          closed.push(demande.id);
      }
      return { closed };
    },

    /**
     * A space's Demandes, for its members. The page gets them all; an extension, what it shows (site-optizzz.md,
     * « Ce que l'extension relève »): the validated ones, those to validate for an Admin or a Délégué, and its
     * Joueur's own open ones (to close them). The open Demandes of a Joueur no longer in the space are left out. With
     * `since` (a cursor from an earlier answer), only those changed after it, and the ids still to keep.
     */
    async read(userId: string, input: { spaceId: string; scope: "page" | "extension"; since?: number }) {
      if (!SPACE_ID.test(input.spaceId)) throw new DemandeError("not-found", "Cet espace n'existe pas.");
      const space = await store.space(input.spaceId);
      if (!space) throw new DemandeError("not-found", "Cet espace n'existe pas.");
      const reader = space.members.find((m) => m.userId === userId);
      if (!reader) throw new DemandeError("forbidden", "Vous n'êtes pas membre de cet espace.");
      const validator = reader.role === "admin" || reader.role === "delegate";
      const at = now();
      const member = (d: DemandeRow) => space.members.some((m) => m.server === d.server && m.playerId === d.playerId);
      const shown = (d: DemandeRow) => {
        const open = OPEN_STATUSES.includes(d.status);
        if (open && !member(d)) return false;
        if (input.scope === "page") return true;
        const own = d.server === reader.server && d.playerId === reader.playerId;
        return d.status === "validated" || (d.status === "pending" && (validator || own));
      };
      // Each requester's Demandes together, in their order.
      const rows = (await store.demandes(space.id, at))
        .filter(shown)
        .sort((a, b) => a.server.localeCompare(b.server) || a.playerId - b.playerId || a.rank - b.rank);
      const since = input.since !== undefined && Number.isFinite(input.since) ? input.since : undefined;
      return {
        cursor: at.getTime() - CURSOR_OVERLAP,
        demandes: rows.filter((d) => since === undefined || d.updatedAt.getTime() > since).map(served),
        live: since === undefined ? null : rows.map((d) => d.id),
      };
    },
  };
}
