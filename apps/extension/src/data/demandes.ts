// What the extension keeps for the Demandes (docs/features/site-demandes.md). The relève of each space's Demandes,
// opened, in storage.session like the Envois' (forgotten when the browser closes, or with the Clé d'alliance). In
// storage.local, per server: the Convoi pages opened from « Envoyer un convoi » (each waits a while for the convoy the
// player launches from it), and the convoys so attached to a Demande, which leave with « Convois ».
import type { DemandeContent, DemandeStatus } from "@optizzz/game/site-links/demandes";
import { storage } from "wxt/utils/storage";
import { withStorageLock } from "@/utils/storage-lock";

/** Removed with the Clé d'alliance (forgetKeys, data/envois.ts). */
const RELEVE_KEY = "session:optizzzAccount:demandes";

/** A Demande of the relève, opened. */
export interface OpenedDemande {
  id: string;
  playerId: number;
  status: DemandeStatus;
  rank: number;
  createdAt: number;
  content: DemandeContent;
}

export interface DemandeReleve {
  cursor: number;
  rows: Partial<Record<string, OpenedDemande>>;
}

export async function loadDemandeReleve(spaceId: string): Promise<DemandeReleve | null> {
  return (await storage.getItem<Partial<Record<string, DemandeReleve>>>(RELEVE_KEY))?.[spaceId] ?? null;
}

export async function storeDemandeReleve(spaceId: string, releve: DemandeReleve): Promise<void> {
  const all = (await storage.getItem<Partial<Record<string, DemandeReleve>>>(RELEVE_KEY)) ?? {};
  await storage.setItem(RELEVE_KEY, { ...all, [spaceId]: releve });
}

/** A convoy as commerce.php lists it, to match a launch with: milliseconds since 1970. */
export interface ConvoySignature {
  food: number;
  materials: number;
  at: number;
}

/** A Convoi page opened from « Envoyer un convoi »: the next convoy to `recipient` is the Demande's. */
export interface ConvoyIntent {
  demande: string;
  recipient: string;
  openedAt: number;
  /** The convoys already on their way to `recipient` then: not the one launched for the Demande. */
  before: ConvoySignature[];
}

/** A convoy launched for a Demande. */
export interface AttachedConvoy extends ConvoySignature {
  /** Drawn by the extension: its identity, whose fingerprint files it on the site. */
  id: string;
  demande: string;
  to: string;
  attachedAt: number;
}

export interface DemandeConvoys {
  intents: ConvoyIntent[];
  convoys: AttachedConvoy[];
}

const EMPTY: DemandeConvoys = { intents: [], convoys: [] };

const key = (origin: string) => `local:demandeConvoys:${new URL(origin).host}` as const;

export async function loadDemandeConvoys(origin: string): Promise<DemandeConvoys> {
  return (await storage.getItem<DemandeConvoys>(key(origin))) ?? EMPTY;
}

/** Changes what is kept for a server, one change at a time; written only when it changed (the Envoi follows writes). */
export function updateDemandeConvoys(
  origin: string,
  update: (kept: DemandeConvoys) => DemandeConvoys,
): Promise<DemandeConvoys> {
  return withStorageLock(key(origin), async () => {
    const kept = await loadDemandeConvoys(origin);
    const next = update(kept);
    if (JSON.stringify(next) !== JSON.stringify(kept)) await storage.setItem<DemandeConvoys>(key(origin), next);
    return next;
  });
}
