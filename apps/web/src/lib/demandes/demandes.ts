// The Demandes on a space page (docs/features/site-demandes.md): sealed here with the Clé d'alliance when made, opened
// here to be shown, each with what the convoys attached to it cover (the members' Envois `demande-convoys`). A Demande
// whose inside does not name its row is thrown away and counted.
import { sealDeclaration } from "~/lib/envois/declarations";
import type { AllianceKeyring } from "@optizzz/crypto/alliance-key";
import {
  DECLARED_CONVOY_CATEGORY,
  DEMANDE_CONVOY_ITEM,
  demandeLabel,
  demandeProgress,
  openDemande,
  sealDemande,
  shownStatus,
  type AttachedConvoy,
  type DemandeContent,
  type DemandeConvoy,
  type DemandeProgress,
  type DemandeStatus,
  type ShownStatus,
} from "@optizzz/game/site-links/demandes";
import type { MemberStates } from "@optizzz/game/sharing/shared-state";
import type { ConvoyItem } from "@optizzz/game/site-links/envoi-convoys";
import { openEnvoi } from "@optizzz/game/site-links/envois";
import { comparePriorites, prioriteOf, type Priorite } from "@optizzz/game/site-links/priorite";
import { distance, travelTime } from "@optizzz/game/travel";
import { envoiCrypto } from "~/lib/envois/convoys";

/** A Demande as the site serves it: its content still encrypted. */
export interface ServedDemande {
  id: string;
  server: string;
  playerId: number;
  status: DemandeStatus;
  rank: number;
  blob: string;
  createdAt: number;
  decidedAt: number | null;
  decidedByPseudo: string | null;
  endedAt: number | null;
}

export interface OpenedDemande extends Omit<ServedDemande, "status" | "blob"> {
  /** « couverte » for a validated Demande the convoys cover. */
  status: ShownStatus;
  stored: DemandeStatus;
  requester: string;
  label: string;
  content: DemandeContent;
  progress: DemandeProgress;
}

interface EnvoiRowInput {
  server: string;
  playerId: number;
  category: string;
  fingerprint: string;
  blob: string;
}

/** A new Demande: its id drawn here, its content sealed for it with the newest version of the key. */
export async function newDemande(
  demande: { server: string; playerId: number; content: DemandeContent },
  keyring: AllianceKeyring,
): Promise<{ id: string; blob: string; keyVersion: number }> {
  const id = crypto.randomUUID();
  const blob = await sealDemande({ id, ...demande }, envoiCrypto(keyring));
  return { id, blob, keyVersion: Math.max(...keyring.map((k) => k.version)) };
}

/** The same Demande sealed again with what its requester changed, with the newest version of the key. */
export async function resealDemande(
  demande: { id: string; server: string; playerId: number },
  content: DemandeContent,
  keyring: AllianceKeyring,
): Promise<{ blob: string; keyVersion: number }> {
  const blob = await sealDemande({ ...demande, content }, envoiCrypto(keyring));
  return { blob, keyVersion: Math.max(...keyring.map((k) => k.version)) };
}

/**
 * A convoy its sender declares for a Demande, as an Envoi of their Joueur (`declared-convoys`): sealed here, its
 * fingerprint keyed from a random id (no two declarations alike), kept 90 days after its arrival.
 */
export function declaredConvoyEnvoi(
  sender: { server: string; playerId: number },
  convoy: DemandeConvoy,
  keyring: AllianceKeyring,
  now: Date,
): Promise<{ keyVersion: number; item: { fingerprint: string; blob: string; expiresAt: number } }> {
  return sealDeclaration(sender, DECLARED_CONVOY_CATEGORY, convoy, keyring, now);
}

/**
 * The convoys attached to Demandes among a space's Envois, those that open: from « Envoyer un convoi », and those
 * declared on this page (with who declared them, for « Retirer »).
 */
async function attachedConvoys(rows: readonly EnvoiRowInput[], keyring: AllianceKeyring): Promise<AttachedConvoy[]> {
  const crypto = envoiCrypto(keyring);
  const open = (row: EnvoiRowInput): Promise<AttachedConvoy | null> => {
    if (row.category === "demande-convoys")
      return openEnvoi({ ...row, category: "demande-convoys" }, crypto, DEMANDE_CONVOY_ITEM).then(
        ({ item }): AttachedConvoy => item,
        () => null,
      );
    if (row.category === DECLARED_CONVOY_CATEGORY)
      return openEnvoi({ ...row, category: DECLARED_CONVOY_CATEGORY }, crypto, DEMANDE_CONVOY_ITEM).then(
        ({ item }): AttachedConvoy => ({ ...item, declared: { playerId: row.playerId, fingerprint: row.fingerprint } }),
        () => null,
      );
    return Promise.resolve(null);
  };
  const opened = await Promise.all(rows.map(open));
  return opened.filter((convoy) => convoy !== null);
}

/**
 * The Demandes that open, each named after its requester among the members (« un ancien membre » otherwise), and the
 * convoys attached to them (for the Convois statistics).
 */
export async function openDemandes(
  demandes: readonly ServedDemande[],
  envois: readonly EnvoiRowInput[],
  keyring: AllianceKeyring,
  members: readonly { playerId: number; pseudo: string }[],
  now: Date,
): Promise<{ demandes: OpenedDemande[]; refused: number; convoys: AttachedConvoy[] }> {
  const crypto = envoiCrypto(keyring);
  const convoys = await attachedConvoys(envois, keyring);
  let refused = 0;
  const opened = await Promise.all(
    demandes.map(async (served) => {
      try {
        const content = await openDemande(served, crypto);
        const requester = members.find((m) => m.playerId === served.playerId)?.pseudo ?? "un ancien membre";
        const progress = demandeProgress({ id: served.id, requester, cost: content.cost }, convoys, now);
        const { id, server, playerId, rank, createdAt, decidedAt, decidedByPseudo, endedAt, status } = served;
        return {
          ...{ id, server, playerId, rank, createdAt, decidedAt, decidedByPseudo, endedAt },
          status: shownStatus(status, progress.covered),
          stored: status,
          requester,
          label: demandeLabel(content),
          content,
          progress,
        } satisfies OpenedDemande;
      } catch {
        refused += 1;
        return null;
      }
    }),
  );
  return { demandes: opened.filter((d) => d !== null), refused, convoys };
}

/**
 * Whether a member of this role validates or refuses a Demande à valider, as the site's rule does
 * (src/server/demandes/demande-service.ts): an Admin any of them, their own too; a Délégué the others' only.
 */
export function canDecide(role: "admin" | "delegate" | "member", mine: boolean): boolean {
  return role === "admin" || (role === "delegate" && !mine);
}

/**
 * Each requester's Priorité, from the Envois opened on this page (never on the site): their convoys, counted once each
 * as `openConvoys` gives them, and their Production state. A requester who does not send their Convois has no Solde
 * told (only what the others report would count), one who does not send Production no Production.
 */
export function requesterPriorites(
  requesters: readonly { playerId: number; pseudo: string }[],
  envois: {
    convoys: readonly ConvoyItem[];
    states: readonly MemberStates[];
    sends: readonly { playerId: number; categories: readonly string[] }[];
  },
  now: Date,
): Map<number, Priorite> {
  const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
  return new Map(
    requesters.map(({ playerId, pseudo }) => {
      const categories = envois.sends.find((s) => s.playerId === playerId)?.categories ?? [];
      const production = categories.includes("production")
        ? (envois.states.find((s) => same(s.latest.pseudo, pseudo) && s.latest.production)?.latest.production ?? null)
        : null;
      const convoys = categories.includes("convoys") ? envois.convoys : null;
      return [playerId, prioriteOf({ player: pseudo, convoys, production, now })];
    }),
  );
}

const UNKNOWN: Priorite = { kind: "unknown", solde: null, production: null, missing: ["production", "convoys"] };

/**
 * The tab's three lists: to validate; validated (waiting for convoys or covered); finished (closed, cancelled,
 * refused: kept 90 days). The open ones by their requester's Priorité, the lowest first and the unknown last; each
 * requester's together, in their order; the oldest requester first among equal Priorités.
 */
export function groupDemandes(
  demandes: readonly OpenedDemande[],
  priorites: ReadonlyMap<number, Priorite> = new Map(),
) {
  const prioriteOfRequester = (d: OpenedDemande) => priorites.get(d.playerId) ?? UNKNOWN;
  const sorted = [...demandes].sort(
    (a, b) =>
      comparePriorites(prioriteOfRequester(a), prioriteOfRequester(b)) || a.playerId - b.playerId || a.rank - b.rank,
  );
  return {
    pending: sorted.filter((d) => d.stored === "pending"),
    active: sorted.filter((d) => d.stored === "validated"),
    finished: [...demandes]
      .filter((d) => d.stored !== "pending" && d.stored !== "validated")
      .sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0)),
  };
}

/** A convoy's trip from the member's nest to a requester's: the distance, and the time at the member's Attack Speed. */
export interface Delivery {
  distance: number;
  seconds: number;
  /** The member's Attack Speed is not known: the alliance's median level is used. */
  estimated: boolean;
}

/**
 * Each requester's trip from `from`'s nest, from the export's coordinates; a requester without a nest in the export
 * has none.
 */
export function deliveries(
  nests: readonly { id: number; x: number; y: number }[],
  from: number,
  speed: { level: number; estimated: boolean },
  recipients: Iterable<number>,
): Map<number, Delivery> {
  const byId = new Map(nests.map((nest) => [nest.id, nest]));
  const start = byId.get(from);
  const trips = new Map<number, Delivery>();
  if (!start) return trips;
  for (const id of recipients) {
    const end = byId.get(id);
    if (!end || id === from) continue;
    const squares = distance(start, end);
    trips.set(id, { distance: squares, seconds: travelTime(squares, speed.level), estimated: speed.estimated });
  }
  return trips;
}

/** The nearest requester first; one without a trip (no nest in the export, or the member's own) last. */
export const byDistance =
  (trips: ReadonlyMap<number, Delivery>) =>
  (a: { playerId: number }, b: { playerId: number }): number =>
    (trips.get(a.playerId)?.distance ?? Infinity) - (trips.get(b.playerId)?.distance ?? Infinity);
