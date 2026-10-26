// What the site, the space page and the extension agree on for the Demandes (docs/features/site-demandes.md): what a
// Demande asks for (sealed with the Clé d'alliance, bound to its row), its statuses, the convoys attached to it and
// what they cover, the Demandes a game page shows reached, and the link that opens the game's Convoi page for one.
// The cipher is passed in (EnvoiCrypto), as for the Envois: this package never imports libsodium.
import { z } from "zod";
import { levelsCost, type LevelKey } from "../level-costs";
import { BUILDINGS, RESEARCH, sameName } from "../levels";
import type { EnvoiCrypto } from "./envois";

const DAY = 24 * 3600_000;

/** How long the site keeps a Demande once closed, cancelled or refused (site-optizzz.md, « Conservation »). */
export const DEMANDES_KEPT_MS = 90 * DAY;

/** The statuses the site keeps, in clear. « Couverte » is not one: every reader works it out from the convoys. */
export const DEMANDE_STATUSES = ["pending", "validated", "refused", "closed", "cancelled"] as const;
export type DemandeStatus = (typeof DEMANDE_STATUSES)[number];
/** What a reader shows: a validated Demande that the convoys cover is « couverte ». */
export type ShownStatus = DemandeStatus | "covered";

/** Pending or validated: the requester may still cancel it, their extension close it. */
export const OPEN_STATUSES: readonly DemandeStatus[] = ["pending", "validated"];

/** In words, always (ADR 0003: a status is never told by a colour alone). */
export const STATUS_LABEL: Record<ShownStatus, string> = {
  pending: "à valider",
  validated: "validée",
  covered: "couverte",
  refused: "refusée",
  closed: "close",
  cancelled: "annulée",
};

const LEVEL_ITEMS = [...BUILDINGS, ...RESEARCH];
const LEVEL_KEYS = LEVEL_ITEMS.map((item) => item.key) as [LevelKey, ...LevelKey[]];
/** Levels a Demande may aim at: well beyond what Toolzzz lists (docs/research/couts-des-niveaux.md). */
export const MAX_DEMANDE_LEVEL = 80;

const amount = z.number().int().nonnegative().max(1e15);
const resources = z.object({ food: amount, materials: amount });
export type Resources = z.infer<typeof resources>;

/** What a Demande asks for, inside the encryption: never in clear on the site. */
export const DEMANDE_CONTENT = z
  .object({
    key: z.enum(LEVEL_KEYS),
    /** The level held when asking. */
    from: z.number().int().nonnegative().max(MAX_DEMANDE_LEVEL),
    /** The level aimed at. */
    level: z.number().int().positive().max(MAX_DEMANDE_LEVEL),
    /** What it asks the alliance for: nourriture and matériaux, what a convoy carries. */
    cost: resources,
    /** Typed by the requester rather than taken from the cost table. */
    typed: z.boolean(),
  })
  .refine((c) => c.level > c.from);
export type DemandeContent = z.infer<typeof DEMANDE_CONTENT>;

/** A Demande's row as the site files it: its id, and its requester. */
interface DemandeRow {
  id: string;
  server: string;
  playerId: number;
}

const ENVELOPE = z.object({
  v: z.literal(1),
  id: z.string(),
  server: z.string(),
  playerId: z.number().int(),
  content: z.unknown(),
});

/** Why a reader throws a Demande away. */
export class DemandeRefused extends Error {
  override readonly name = "DemandeRefused";
  constructor(readonly reason: "unreadable" | "mismatch") {
    super(reason === "mismatch" ? "This Demande names another row than its own." : "This Demande does not open.");
  }
}

export function sealDemande(demande: DemandeRow & { content: DemandeContent }, crypto: EnvoiCrypto): Promise<string> {
  const { id, server, playerId, content } = demande;
  return crypto.encrypt(JSON.stringify({ v: 1, id, server, playerId, content }));
}

/**
 * Opens a Demande and checks that its inside names its row: the site can neither move one to another requester nor
 * swap two Demandes. Throws DemandeRefused.
 */
export async function openDemande(row: DemandeRow & { blob: string }, crypto: EnvoiCrypto): Promise<DemandeContent> {
  let envelope: z.infer<typeof ENVELOPE>;
  let content: DemandeContent;
  try {
    envelope = ENVELOPE.parse(JSON.parse(await crypto.decrypt(row.blob)));
    content = DEMANDE_CONTENT.parse(envelope.content);
  } catch {
    throw new DemandeRefused("unreadable");
  }
  if (envelope.id !== row.id || envelope.server !== row.server || envelope.playerId !== row.playerId)
    throw new DemandeRefused("mismatch");
  return content;
}

export const levelName = (key: LevelKey) => LEVEL_ITEMS.find((item) => item.key === key)?.name ?? key;

/** « Champignonnière niveau 12 », « Vitesse d’attaque niveaux 5 à 6 ». */
export function demandeLabel(content: Pick<DemandeContent, "key" | "from" | "level">): string {
  const name = levelName(content.key);
  return content.level - content.from <= 1
    ? `${name} niveau ${String(content.level)}`
    : `${name} niveaux ${String(content.from + 1)} à ${String(content.level)}`;
}

/** The levels after `from` up to `to`, from the cost table: nourriture and matériaux only (a convoy carries no workers). */
export function tableCost(key: LevelKey, from: number, to: number): Resources {
  const { cost } = levelsCost(key, from, to);
  return { food: cost.food, materials: cost.materials };
}

// ── The convoys attached to a Demande

/**
 * A convoy launched from « Envoyer un convoi » on a Demande, as its sender's extension sends it (the Envoi category
 * `demande-convoys`, with « Convois » checked): only its sender knows it was for that Demande.
 */
export const DEMANDE_CONVOY_ITEM = z.object({
  demande: z.uuid(),
  from: z.string().min(1).max(40),
  to: z.string().min(1).max(40),
  food: amount,
  materials: amount,
  /** Milliseconds since 1970: the arrival. */
  at: z.number().int().nonnegative(),
});
export type DemandeConvoy = z.infer<typeof DEMANDE_CONVOY_ITEM>;

export interface DemandeProgress {
  received: Resources;
  onWay: Resources;
  /** The cost less what was received and is on its way, never below zero. */
  remaining: Resources;
  /** Received and on their way reach the cost. */
  covered: boolean;
}

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** What the convoys attached to a Demande, toward its requester, cover of its cost. */
export function demandeProgress(
  demande: { id: string; requester: string; cost: Resources },
  convoys: readonly DemandeConvoy[],
  now: Date,
): DemandeProgress {
  const received = { food: 0, materials: 0 };
  const onWay = { food: 0, materials: 0 };
  for (const convoy of convoys) {
    if (convoy.demande !== demande.id || !same(convoy.to, demande.requester)) continue;
    const into = convoy.at <= now.getTime() ? received : onWay;
    into.food += convoy.food;
    into.materials += convoy.materials;
  }
  const remaining = {
    food: Math.max(0, demande.cost.food - received.food - onWay.food),
    materials: Math.max(0, demande.cost.materials - received.materials - onWay.materials),
  };
  return { received, onWay, remaining, covered: remaining.food === 0 && remaining.materials === 0 };
}

export const shownStatus = (status: DemandeStatus, covered: boolean): ShownStatus =>
  status === "validated" && covered ? "covered" : status;

// ── Closing: what the requester's game pages show

/** What construction.php or laboratoire.php shows: the levels held, and the works under way with the level they reach. */
export interface ShownLevels {
  levels: Partial<Record<LevelKey, number>>;
  works: readonly { name: string; level: number }[];
}

/** The Demandes whose level the page shows reached, or whose work is under way: their requester's extension closes them. */
export function reachedDemandes(
  open: readonly { id: string; content: Pick<DemandeContent, "key" | "level"> }[],
  shown: ShownLevels,
): string[] {
  return open
    .filter(({ content }) => {
      const held = shown.levels[content.key];
      if (held !== undefined && held >= content.level) return true;
      const name = levelName(content.key);
      return shown.works.some((work) => sameName(work.name, name) && work.level >= content.level);
    })
    .map(({ id }) => id);
}

// ── « Envoyer un convoi »

const FRAGMENT = "optizzz-demande";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export const isDemandeId = (value: unknown): value is string => typeof value === "string" && UUID.test(value);

/**
 * The game's Convoi page for a Demande: its id in the fragment, which the browser never sends to the game. The
 * extension fills the form from it; the player clicks « Lancer le convoi » themself.
 */
export const demandeConvoyLink = (origin: string, id: string) => `${origin}/commerce.php#${FRAGMENT}=${id}`;

export function demandeIdOfHash(hash: string): string | null {
  const id = new URLSearchParams(hash.replace(/^#/, "")).get(FRAGMENT);
  return isDemandeId(id) ? id : null;
}

/** What the form gets: the remainder, within what the player holds (`short` when they hold less). */
export function convoyFill(remaining: Resources, stock: Resources | null): Resources & { short: boolean } {
  if (!stock) return { ...remaining, short: false };
  const food = Math.min(remaining.food, stock.food);
  const materials = Math.min(remaining.materials, stock.materials);
  return { food, materials, short: food < remaining.food || materials < remaining.materials };
}
