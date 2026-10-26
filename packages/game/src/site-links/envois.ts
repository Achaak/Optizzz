// What the site, the space page and the extension agree on for the Envois (docs/features/site-envois.md): the
// categories, what a Joueur chooses to send, and the envelope of one Envoi. The cipher is passed in (EnvoiCrypto),
// libsodium's in practice (@optizzz/crypto), which this package never imports: the extension's light script uses it.
import { z } from "zod";

/** The six categories of « Fonctionnalités » → « Compte Optizzz », all off by default. */
export interface EnvoiChoices {
  production: boolean;
  convoys: boolean;
  floods: boolean;
  hunts: boolean;
  /** « Rien », « Nombre » or « Par unité », as « Mon état ». */
  army: "none" | "count" | "units";
  levels: boolean;
}

export const NO_ENVOIS: EnvoiChoices = {
  production: false,
  convoys: false,
  floods: false,
  hunts: false,
  army: "none",
  levels: false,
};

/** What a Joueur sends, as the site keeps it and the space page shows it. */
export const SENT_CATEGORIES = [
  "production",
  "convoys",
  "floods",
  "hunts",
  "army-count",
  "army-units",
  "levels",
] as const;
export type SentCategory = (typeof SENT_CATEGORIES)[number];

/**
 * The categories whose Envois are encrypted rows: one per item (lists) or per Joueur (states). `demande-convoys`, the
 * convoys launched for a Demande (docs/features/site-demandes.md), leaves with « Convois ».
 */
export type EnvoiCategory = "production" | "convoys" | "floods" | "hunts" | "army" | "levels" | "demande-convoys";

const LABELS: Record<SentCategory, string> = {
  production: "production",
  convoys: "convois",
  floods: "floods",
  hunts: "chasses",
  "army-count": "armée (nombre)",
  "army-units": "armée (par unité)",
  levels: "niveaux et chantiers",
};

export function categoriesOf(choices: EnvoiChoices): SentCategory[] {
  const army: SentCategory[] =
    choices.army === "count" ? ["army-count"] : choices.army === "units" ? ["army-units"] : [];
  return SENT_CATEGORIES.filter(
    (category) =>
      army.includes(category) ||
      (category !== "army-count" && category !== "army-units" && choices[category as keyof EnvoiChoices] === true),
  );
}

/** Whether a Joueur's choices send a category: the army as a number or by unit. */
export const isSent = (choices: EnvoiChoices, category: EnvoiCategory): boolean =>
  category === "army" ? choices.army !== "none" : category === "demande-convoys" ? choices.convoys : choices[category];

/** « Envoie : convois, floods », or « N'envoie rien ». */
export function sendsLabel(categories: readonly SentCategory[]): string {
  const known = SENT_CATEGORIES.filter((category) => categories.includes(category));
  return known.length === 0 ? "N'envoie rien" : `Envoie : ${known.map((category) => LABELS[category]).join(", ")}`;
}

export const isSentCategory = (value: unknown): value is SentCategory =>
  typeof value === "string" && (SENT_CATEGORIES as readonly string[]).includes(value);

/** The cipher, bound to the space's Clé d'alliance: libsodium's in the extension's background and on the site's page. */
export interface EnvoiCrypto {
  /** With the newest version (ADR 0005, « Donnée d'alliance chiffrée »). */
  encrypt(text: string): Promise<string>;
  /** With the version the blob names. */
  decrypt(blob: string): Promise<string>;
  /** Keyed with the newest version (ADR 0005, « Empreinte d'une donnée d'alliance »). */
  fingerprint(text: string): Promise<string>;
}

/** One Envoi as the site keeps it: who sent it, where, what, its fingerprint and the encrypted envelope. */
export interface EnvoiRow {
  server: string;
  playerId: number;
  category: EnvoiCategory;
  fingerprint: string;
  blob: string;
}

/** Inside the encryption: the row's identity again, and when the extension read it, then the item. */
export interface EnvoiEnvelope<T> {
  server: string;
  playerId: number;
  category: EnvoiCategory;
  fingerprint: string;
  /** Milliseconds since 1970: when the extension read what it sends. */
  observedAt: number;
  item: T;
}

const ENVELOPE = z.object({
  v: z.literal(1),
  server: z.string(),
  playerId: z.number().int(),
  category: z.string(),
  fingerprint: z.string(),
  observedAt: z.number().int().nonnegative(),
  item: z.unknown(),
});

/** Why a reader throws an Envoi away. */
export class EnvoiRefused extends Error {
  override readonly name = "EnvoiRefused";
  constructor(readonly reason: "unreadable" | "mismatch") {
    super(reason === "mismatch" ? "This Envoi names another row than its own." : "This Envoi does not open.");
  }
}

export function sealEnvoi<T>(envelope: EnvoiEnvelope<T>, crypto: EnvoiCrypto): Promise<string> {
  const { server, playerId, category, fingerprint, observedAt, item } = envelope;
  return crypto.encrypt(JSON.stringify({ v: 1, server, playerId, category, fingerprint, observedAt, item }));
}

/**
 * Opens an Envoi and checks that its inside names its row: the site can neither file one member's Envoi under
 * another's name, nor move it to another category or fingerprint. Throws EnvoiRefused.
 */
export async function openEnvoi<T>(
  row: EnvoiRow,
  crypto: EnvoiCrypto,
  itemSchema: z.ZodType<T>,
): Promise<{ observedAt: number; item: T }> {
  let envelope: z.infer<typeof ENVELOPE>;
  let item: T;
  try {
    envelope = ENVELOPE.parse(JSON.parse(await crypto.decrypt(row.blob)));
    item = itemSchema.parse(envelope.item);
  } catch {
    throw new EnvoiRefused("unreadable");
  }
  if (
    envelope.server !== row.server ||
    envelope.playerId !== row.playerId ||
    envelope.category !== row.category ||
    envelope.fingerprint !== row.fingerprint
  )
    throw new EnvoiRefused("mismatch");
  return { observedAt: envelope.observedAt, item };
}

/**
 * The same datum reported by several members (a convoy, by its sender and its recipient) counts once: the newest
 * reading of each fingerprint, in the order first met.
 */
export function newestPerFingerprint<T extends { fingerprint: string; observedAt: number }>(rows: readonly T[]): T[] {
  const kept = new Map<string, T>();
  for (const row of rows) {
    const known = kept.get(row.fingerprint);
    if (!known || row.observedAt > known.observedAt) kept.set(row.fingerprint, row);
  }
  return [...kept.values()];
}
