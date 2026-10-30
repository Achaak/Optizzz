// The Demandes in the background script (docs/features/site-demandes.md). The relève reads each space's Demandes the
// extension shows (validated ones; those to validate for an Admin or a Délégué; the Joueur's own open ones) and opens
// them with the Clé d'alliance. The game's pages ask what to show, already decrypted: commerce.php the alliance's
// Demandes with what remains to send, « Envoyer un convoi » what to fill the form with (the player clicks « Lancer le
// convoi » themself: nothing here submits a form of the game), construction.php and laboratoire.php what they show
// reached, which closes the Joueur's own Demandes on the site. Only optizzz.fr is read, never the game.
import {
  convoyFill,
  demandeLabel,
  demandeProgress,
  openDemande,
  reachedDemandes,
  shownStatus,
  type Resources,
  type ShownLevels,
  type ShownStatus,
} from "@optizzz/game/site-links/demandes";
import type { ProductionReading } from "@optizzz/game/site-links/envoi-states";
import { newestPerFingerprint, type EnvoiCrypto } from "@optizzz/game/site-links/envois";
import { comparePriorites, prioriteOf, prioriteText, type Priorite } from "@optizzz/game/site-links/priorite";
import { SITE_ORIGIN } from "@/utils/site";
import { SPACES_PATH, type HandedKey } from "@optizzz/game/site-links/space-bridge";
import { loadConvoys } from "@/data/convoys";
import { loadDemandeReleve, storeDemandeReleve, updateDemandeConvoys, type OpenedDemande } from "@/data/demandes";
import { loadChoices, loadKeys, loadReleve, loadSpaces, type SpacePlayer } from "@/data/envois";
import { loadCurrentPlayer } from "@/data/optizzz-account";
import { siteApi } from "./api";
import { attachLaunched } from "./demande-convoys";

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

interface Dependencies {
  now: () => Date;
  fetch: Fetch;
  crypto: (keys: HandedKey[]) => EnvoiCrypto;
  /** The extension's link to its account, when optizzz.fr is granted. */
  link: () => Promise<{ token: string } | null>;
  /** The token was removed from /account. */
  unlinked: () => Promise<void>;
  /** A random id for a convoy attached to a Demande. */
  newId?: () => string;
}

/** A Demande as a game page shows it. */
export interface DemandeView {
  id: string;
  requester: string;
  /** « Champignonnière niveau 12 ». */
  label: string;
  status: ShownStatus;
  cost: Resources;
  remaining: Resources;
  onWay: Resources;
}

/** Why a game page shows no Demande: not linked, not in a space, the key missing. */
type Problem = "unlinked" | "no-space" | "no-key";

/** commerce.php: the alliance's Demandes. */
export type DemandesAnswer =
  | { problem: Problem }
  | {
      problem: null;
      /** The space's page on optizzz.fr. */
      spaceUrl: string;
      /**
       * The others' validated Demandes by their requester's Priorité, each requester's in their order; `priorite` as
       * the site writes it (« 18,4 jours », « Priorité inconnue »).
       */
      open: (DemandeView & { priorite: string })[];
      /** The Joueur's own open Demandes. */
      mine: DemandeView[];
      /** Demandes to validate: those of the others, served to an Admin or a Délégué only. */
      toValidate: number;
      /** The Joueur sends « Convois »: a convoy launched from a Demande is attached to it. */
      attaches: boolean;
    };

/** « Envoyer un convoi »: what to fill the form with, or why not. */
export type ConvoyFillAnswer =
  | { ok: false; message: string }
  | {
      ok: true;
      recipient: string;
      label: string;
      food: number;
      materials: number;
      /** The player holds less than what remains. */
      short: boolean;
      attaches: boolean;
    };

const sameName = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const serverOfHost = (host: string) => /^(s\d{1,2})\.fourmizzz\.fr$/.exec(host)?.[1] ?? null;

export function demandeService({
  now,
  fetch,
  crypto,
  link,
  unlinked,
  newId = () => globalThis.crypto.randomUUID(),
}: Dependencies) {
  /** Reads a space's Demandes changed since the last relève, opens them, and keeps those still served. */
  async function releve(token: string, spaceId: string, keys: HandedKey[]): Promise<void> {
    const previous = await loadDemandeReleve(spaceId);
    const answer = await siteApi(token, fetch).readDemandes(spaceId, previous?.cursor ?? null);
    if (!answer.ok) {
      if (answer.unlinked) await unlinked();
      return;
    }
    const cipher = crypto(keys);
    const live = answer.value.live ? new Set(answer.value.live) : null;
    const rows: Partial<Record<string, OpenedDemande>> =
      previous && live ? Object.fromEntries(Object.entries(previous.rows).filter(([id]) => live.has(id))) : {};
    for (const row of answer.value.demandes) {
      try {
        const content = await openDemande(row, cipher);
        rows[row.id] = {
          id: row.id,
          playerId: row.playerId,
          status: row.status,
          rank: row.rank,
          createdAt: row.createdAt,
          content,
        };
      } catch {
        // Altered, filed under another row, or a version not held: left out.
        rows[row.id] = undefined;
      }
    }
    await storeDemandeReleve(spaceId, { cursor: answer.value.cursor, rows });
  }

  /** The game's logged-in Joueur on a server, their space, its Demandes and the convoys attached to them. */
  async function read(origin: string) {
    const server = serverOfHost(new URL(origin).host);
    const pseudo = await loadCurrentPlayer(origin);
    if (!server || !pseudo || !(await link())) return { problem: "unlinked" as const };
    const player = (await loadSpaces())?.players.find((p) => p.server === server && sameName(p.pseudo, pseudo));
    if (!player?.space) return { problem: "no-space" as const };
    const releveRows = await loadDemandeReleve(player.space.id);
    if (!releveRows || !(await loadKeys(player.space.id, now()))) return { problem: "no-key" as const };
    const envois = await loadReleve(player.space.id);
    const attached = Object.values(envois?.rows ?? {}).flatMap((r) =>
      r?.category === "demande-convoys" ? [r.item] : [],
    );
    const demandes = Object.values(releveRows.rows).flatMap((d) => (d ? [d] : []));
    const rows = newestPerFingerprint(Object.values(envois?.rows ?? {}).flatMap((r) => (r ? [r] : [])));
    const convoys = rows.flatMap((r) => (r.category === "convoys" ? [r.item] : []));
    const productions = rows.flatMap((r) =>
      r.category === "production" ? [{ playerId: r.playerId, reading: r.item.reading as ProductionReading }] : [],
    );
    return { problem: null, server, pseudo, player, space: player.space, demandes, attached, convoys, productions };
  }

  /** Each requester's Priorité, as the space page works it out (apps/web/src/lib/demandes/demandes.ts). */
  function priorites(found: Extract<Awaited<ReturnType<typeof read>>, { problem: null }>): Map<number, Priorite> {
    return new Map(
      found.space.members.map((member) => {
        const production = member.categories.includes("production")
          ? (found.productions.find((p) => p.playerId === member.playerId)?.reading ?? null)
          : null;
        const convoys = member.categories.includes("convoys") ? found.convoys : null;
        return [member.playerId, prioriteOf({ player: member.pseudo, convoys, production, now: now() })];
      }),
    );
  }

  function view(
    space: NonNullable<SpacePlayer["space"]>,
    demande: OpenedDemande,
    attached: Parameters<typeof demandeProgress>[1],
  ): DemandeView | null {
    const requester = space.members.find((m) => m.playerId === demande.playerId)?.pseudo;
    if (!requester) return null;
    const { content } = demande;
    const progress = demandeProgress({ id: demande.id, requester, cost: content.cost }, attached, now());
    return {
      id: demande.id,
      requester,
      label: demandeLabel(content),
      status: shownStatus(demande.status, progress.covered),
      cost: content.cost,
      remaining: progress.remaining,
      onWay: progress.onWay,
    };
  }

  const ordered = (a: OpenedDemande, b: OpenedDemande) => a.playerId - b.playerId || a.rank - b.rank;

  /**
   * commerce.php: the others' validated Demandes with what remains to send, by their requester's Priorité (the lowest
   * first, the unknown last, each requester's in their order), the Joueur's own, and those to validate.
   */
  async function demandes(origin: string): Promise<DemandesAnswer> {
    const found = await read(origin);
    if (found.problem !== null) return { problem: found.problem };
    const { player, space, attached } = found;
    const mine = (d: OpenedDemande) => d.playerId === player.playerId;
    const views = (list: OpenedDemande[]) =>
      list.sort(ordered).flatMap((d) => {
        const shown = view(space, d, attached);
        return shown ? [shown] : [];
      });
    const ranks = priorites(found);
    const UNKNOWN = prioriteOf({ player: "", convoys: null, production: null, now: now() });
    const prioriteOfRequester = (d: OpenedDemande) => ranks.get(d.playerId) ?? UNKNOWN;
    const open = found.demandes
      .filter((d) => !mine(d) && d.status === "validated")
      .sort((a, b) => comparePriorites(prioriteOfRequester(a), prioriteOfRequester(b)) || ordered(a, b))
      .flatMap((d) => {
        const shown = view(space, d, attached);
        return shown ? [{ ...shown, priorite: prioriteText(prioriteOfRequester(d)) }] : [];
      });
    return {
      problem: null,
      spaceUrl: `${SITE_ORIGIN}${SPACES_PATH}/${space.id}`,
      open,
      mine: views(found.demandes.filter(mine)),
      toValidate: found.demandes.filter((d) => !mine(d) && d.status === "pending").length,
      attaches: (await loadChoices(found.server, found.pseudo)).convoys,
    };
  }

  /**
   * « Envoyer un convoi » on a Demande: the requester and what remains to send (in-transit convoys deducted, within
   * what the player holds), and the page noted so the convoy launched from it is attached to the Demande.
   */
  async function prepareConvoy(origin: string, id: string, stock: Resources | null): Promise<ConvoyFillAnswer> {
    const found = await read(origin);
    if (found.problem !== null)
      return {
        ok: false,
        message:
          found.problem === "no-key"
            ? "Ouvrez votre espace sur optizzz.fr pour lire les Demandes de l'alliance ici."
            : "Cette Demande n'est pas lisible ici : connectez l'extension à votre Compte Optizzz.",
      };
    const demande = found.demandes.find((d) => d.id === id);
    const shown = demande ? view(found.space, demande, found.attached) : null;
    if (!demande || shown?.status !== "validated")
      return { ok: false, message: "Cette Demande n'attend plus de convoi (couverte, close, ou pas encore validée)." };
    if (demande.playerId === found.player.playerId)
      return { ok: false, message: "C'est votre propre Demande : les autres membres y répondent." };
    const outgoing = await loadConvoys(origin);
    await updateDemandeConvoys(origin, (kept) => ({
      ...kept,
      intents: [
        ...kept.intents.filter((i) => i.demande !== id),
        {
          demande: id,
          recipient: shown.requester,
          openedAt: now().getTime(),
          before: (outgoing?.convoys ?? [])
            .filter((c) => sameName(c.recipient, shown.requester))
            .map((c) => ({ food: c.food, materials: c.materials, at: c.arrivesAt.getTime() })),
        },
      ],
    }));
    const fill = convoyFill(shown.remaining, stock);
    return {
      ok: true,
      recipient: shown.requester,
      label: shown.label,
      ...fill,
      attaches: (await loadChoices(found.server, found.pseudo)).convoys,
    };
  }

  /** construction.php or laboratoire.php showed levels and works: the Joueur's own Demandes reached are closed. */
  async function levelsSeen(origin: string, shown: ShownLevels): Promise<void> {
    const found = await read(origin);
    const kept = await link();
    if (found.problem !== null || !kept) return;
    const own = found.demandes.filter((d) => d.playerId === found.player.playerId);
    const reached = reachedDemandes(own, shown);
    if (reached.length === 0) return;
    const answer = await siteApi(kept.token, fetch).closeDemandes(found.server, found.player.playerId, reached);
    if (!answer.ok) {
      if (answer.unlinked) await unlinked();
      return;
    }
    // Closed: no longer served to the extension.
    const releveRows = await loadDemandeReleve(found.space.id);
    if (releveRows)
      await storeDemandeReleve(found.space.id, {
        ...releveRows,
        rows: Object.fromEntries(
          Object.entries(releveRows.rows).filter(([demandeId]) => !answer.value.closed.includes(demandeId)),
        ),
      });
  }

  /** commerce.php listed the convoys on their way again: the one launched for a Demande gets attached to it. */
  async function attach(origin: string): Promise<void> {
    const outgoing = await loadConvoys(origin);
    await updateDemandeConvoys(origin, (kept) =>
      kept.intents.length === 0 && kept.convoys.length === 0
        ? kept
        : attachLaunched(
            kept,
            outgoing && {
              readAt: outgoing.readAt.getTime(),
              convoys: outgoing.convoys.map((c) => ({
                recipient: c.recipient,
                food: c.food,
                materials: c.materials,
                at: c.arrivesAt.getTime(),
              })),
            },
            now().getTime(),
            newId,
          ),
    );
  }

  return { releve, demandes, prepareConvoy, levelsSeen, attach };
}
