// The Demandes on a space page (docs/features/site-demandes.md): sealed here with the Clé d'alliance when made, opened
// here to be shown, each with what the convoys attached to it cover (the members' Envois `demande-convoys`). A Demande
// whose inside does not name its row is thrown away and counted.
import type { AllianceKeyring } from "@optizzz/crypto/alliance-key";
import {
  DEMANDE_CONVOY_ITEM,
  demandeLabel,
  demandeProgress,
  openDemande,
  sealDemande,
  shownStatus,
  type DemandeContent,
  type DemandeConvoy,
  type DemandeProgress,
  type DemandeStatus,
  type ShownStatus,
} from "@optizzz/game/site-links/demandes";
import { openEnvoi } from "@optizzz/game/site-links/envois";
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

/** The convoys attached to Demandes among a space's Envois, those that open. */
async function attachedConvoys(rows: readonly EnvoiRowInput[], keyring: AllianceKeyring): Promise<DemandeConvoy[]> {
  const crypto = envoiCrypto(keyring);
  const opened = await Promise.all(
    rows
      .filter((row) => row.category === "demande-convoys")
      .map((row) =>
        openEnvoi({ ...row, category: "demande-convoys" }, crypto, DEMANDE_CONVOY_ITEM).then(
          ({ item }) => item,
          () => null,
        ),
      ),
  );
  return opened.filter((convoy) => convoy !== null);
}

/** The Demandes that open, each named after its requester among the members (« un ancien membre » otherwise). */
export async function openDemandes(
  demandes: readonly ServedDemande[],
  envois: readonly EnvoiRowInput[],
  keyring: AllianceKeyring,
  members: readonly { playerId: number; pseudo: string }[],
  now: Date,
): Promise<{ demandes: OpenedDemande[]; refused: number }> {
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
  return { demandes: opened.filter((d) => d !== null), refused };
}

/**
 * Whether a member of this role validates or refuses a Demande à valider, as the site's rule does
 * (src/server/demandes/demande-service.ts): an Admin any of them, their own too; a Délégué the others' only.
 */
export function canDecide(role: "admin" | "delegate" | "member", mine: boolean): boolean {
  return role === "admin" || (role === "delegate" && !mine);
}

/**
 * The tab's three lists: to validate; validated (waiting for convoys or covered); finished (closed, cancelled,
 * refused: kept 90 days). Each requester's together, in their order, the oldest requester first.
 */
export function groupDemandes(demandes: readonly OpenedDemande[]) {
  const sorted = [...demandes].sort((a, b) => a.playerId - b.playerId || a.rank - b.rank);
  return {
    pending: sorted.filter((d) => d.stored === "pending"),
    active: sorted.filter((d) => d.stored === "validated"),
    finished: [...demandes]
      .filter((d) => d.stored !== "pending" && d.stored !== "validated")
      .sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0)),
  };
}
