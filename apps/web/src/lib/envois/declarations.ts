// The page « Déclarer » (ADR 0010, docs/features/site-declarer.md): what a member declares by hand, sealed here with
// the Clé d'alliance as an Envoi of their Joueur, then opened by every member's page and added to the alliance's
// floods, convoys and hunts, marked « déclaré ». A declaration that an Envoi of the same member's extension covers is
// left out: the extension wins. The site knows none of it.
import type { AllianceKeyring } from "@optizzz/crypto/alliance-key";
import { formatNumber } from "@optizzz/game/format/number-format";
import { formatEndTime } from "@optizzz/game/format/time-format";
import type { MemberStates } from "@optizzz/game/sharing/shared-state";
import {
  DECLARATIONS_KEPT_MS,
  DECLARED_FLOOD_CATEGORY,
  DECLARED_FLOOD_ITEM,
  DECLARED_HUNT_CATEGORY,
  DECLARED_HUNT_ITEM,
  DECLARED_TRANSIT_CATEGORY,
  DECLARED_TRANSIT_ITEM,
  floodCovered,
  huntCovered,
  transitCovered,
  type DeclaredFlood,
  type DeclaredFloodItem,
  type DeclaredHunt,
  type DeclaredHuntItem,
  type DeclaredTransit,
  type DeclaredTransitItem,
} from "@optizzz/game/site-links/declarations";
import { DECLARED_CONVOY_CATEGORY, DEMANDE_CONVOY_ITEM, type DemandeConvoy } from "@optizzz/game/site-links/demandes";
import { openEnvoi, sealEnvoi, type DeclaredCategory } from "@optizzz/game/site-links/envois";
import { envoiCrypto, type AllianceConvoy } from "./convoys";
import type { AllianceFlood } from "./floods";
import type { AllianceHunt } from "./hunts";

/** What each category holds. */
interface DeclaredItems {
  "declared-convoys": DemandeConvoy;
  "declared-floods": DeclaredFloodItem;
  "declared-transits": DeclaredTransitItem;
  "declared-hunts": DeclaredHuntItem;
}

/** When a declaration arrives or comes back. */
const whenOf = (category: DeclaredCategory, item: DeclaredItems[DeclaredCategory]): number =>
  category === DECLARED_HUNT_CATEGORY ? (item as DeclaredHuntItem).returnsAt : (item as { at: number }).at;

/**
 * A declaration sealed with the newest version of the key, as an Envoi of the member's Joueur: its fingerprint keyed
 * from a random id (no two declarations alike), kept 90 days after it arrives or comes back.
 */
export async function sealDeclaration<C extends DeclaredCategory>(
  sender: { server: string; playerId: number },
  category: C,
  item: DeclaredItems[C],
  keyring: AllianceKeyring,
  now: Date,
): Promise<{ keyVersion: number; item: { fingerprint: string; blob: string; expiresAt: number } }> {
  const crypto = envoiCrypto(keyring);
  const fingerprint = await crypto.fingerprint(globalThis.crypto.randomUUID());
  const envelope = { ...sender, category, fingerprint, observedAt: now.getTime() };
  return {
    keyVersion: Math.max(...keyring.map((k) => k.version)),
    item: {
      fingerprint,
      blob: await sealEnvoi({ ...envelope, item }, crypto),
      expiresAt: whenOf(category, item) + DECLARATIONS_KEPT_MS,
    },
  };
}

interface Row {
  server: string;
  playerId: number;
  category: string;
  fingerprint: string;
  blob: string;
}

/** Who declared it, and the row it came in (for « Retirer »). */
interface Declared {
  playerId: number;
  fingerprint: string;
}

export interface OpenedDeclarations {
  floods: (DeclaredFlood & Declared)[];
  /** The convoys for no Demande, and those declared for a Demande (`demande` names it). */
  transits: (DeclaredTransit & Declared & { demande: string | null })[];
  hunts: (DeclaredHunt & Declared)[];
  /** The rows that do not open (altered, filed elsewhere, or a missing version). */
  refused: number;
}

/** The declarations of the rows that open, each named after its sender among the members. */
export async function openDeclarations(
  rows: readonly Row[],
  keyring: AllianceKeyring,
  members: readonly { playerId: number; pseudo: string }[],
): Promise<OpenedDeclarations> {
  const crypto = envoiCrypto(keyring);
  const pseudoOf = (playerId: number) => members.find((m) => m.playerId === playerId)?.pseudo ?? "un ancien membre";
  const opened: OpenedDeclarations = { floods: [], transits: [], hunts: [], refused: 0 };
  await Promise.all(
    rows.map(async (row) => {
      const declared = { playerId: row.playerId, fingerprint: row.fingerprint };
      try {
        if (row.category === DECLARED_FLOOD_CATEGORY) {
          const { item } = await openEnvoi({ ...row, category: row.category }, crypto, DECLARED_FLOOD_ITEM);
          opened.floods.push({ ...item, from: pseudoOf(row.playerId), ...declared });
        } else if (row.category === DECLARED_TRANSIT_CATEGORY) {
          const { item } = await openEnvoi({ ...row, category: row.category }, crypto, DECLARED_TRANSIT_ITEM);
          opened.transits.push({ ...item, from: pseudoOf(row.playerId), demande: null, ...declared });
        } else if (row.category === DECLARED_HUNT_CATEGORY) {
          const { item } = await openEnvoi({ ...row, category: row.category }, crypto, DECLARED_HUNT_ITEM);
          opened.hunts.push({ ...item, hunter: pseudoOf(row.playerId), ...declared });
        } else if (row.category === DECLARED_CONVOY_CATEGORY) {
          const { item } = await openEnvoi({ ...row, category: row.category }, crypto, DEMANDE_CONVOY_ITEM);
          const { demande, from, to, food, materials, at } = item;
          opened.transits.push({ demande, from, to, food, materials, at, ...declared });
        }
      } catch {
        opened.refused += 1;
      }
    }),
  );
  // The order the rows came in, whatever the order they opened.
  const order = new Map(rows.map((row, index) => [row.fingerprint, index]));
  const byRow = (a: Declared, b: Declared) => (order.get(a.fingerprint) ?? 0) - (order.get(b.fingerprint) ?? 0);
  opened.floods.sort(byRow);
  opened.transits.sort(byRow);
  opened.hunts.sort(byRow);
  return opened;
}

export interface MyDeclaration {
  category: DeclaredCategory;
  fingerprint: string;
  at: number;
  /** « 3 attaques sur Lasius, arrivée aujourd'hui 18 h 12 ». */
  text: string;
}

const attacks = (n: number) => (n === 1 ? "1 attaque" : `${String(n)} attaques`);

function convoyText(t: { to: string; food: number; materials: number }): string {
  const loads = [
    t.food > 0 ? `${formatNumber(t.food)} nourriture` : null,
    t.materials > 0 ? `${formatNumber(t.materials)} matériaux` : null,
  ].filter((x) => x !== null);
  return `${loads.join(" et ") || "Rien"} à ${t.to}`;
}

/** The member's own declarations still to come, soonest first: what « Vos déclarations » lists, each withdrawn. */
export function myDeclarations(opened: OpenedDeclarations, playerId: number, now: Date): MyDeclaration[] {
  const at = (when: number) => formatEndTime(new Date(when), now);
  const all: (MyDeclaration & { playerId: number })[] = [
    ...opened.floods.map((f) => ({
      ...f,
      category: DECLARED_FLOOD_CATEGORY,
      text: `${attacks(f.attacks)} sur ${f.target}, arrivée ${at(f.at)}`,
    })),
    ...opened.transits.map((t) => ({
      ...t,
      category: t.demande === null ? DECLARED_TRANSIT_CATEGORY : DECLARED_CONVOY_CATEGORY,
      text: `${convoyText(t)}${t.demande === null ? "" : " (Demande)"}, arrivée ${at(t.at)}`,
    })),
    ...opened.hunts.map((h) => ({
      ...h,
      at: h.returnsAt,
      category: DECLARED_HUNT_CATEGORY,
      text: `Chasse de ${formatNumber(h.fieldGain)} cm², retour ${at(h.returnsAt)}`,
    })),
  ];
  return all
    .filter((d) => d.playerId === playerId && d.at > now.getTime())
    .sort((a, b) => a.at - b.at)
    .map(({ category, fingerprint, at: when, text }) => ({ category, fingerprint, at: when, text }));
}

/** The alliance's lists, as the page opened them from the extensions' Envois. */
export interface AllianceLists {
  floods: AllianceFlood[];
  convoys: AllianceConvoy[];
  hunts: AllianceHunt[];
  states: readonly MemberStates[];
}

/**
 * The alliance's floods, convoys and hunts with the declarations not covered by an Envoi of their sender's extension,
 * marked declared: a flood one row per attack (no take expected: that comes from the Plan de flood), a convoy on its
 * way until its arrival and delivered after, a hunt in the hunts log.
 */
export function mergeDeclarations(
  lists: AllianceLists,
  declared: OpenedDeclarations,
  now: Date,
): Pick<AllianceLists, "floods" | "convoys" | "hunts"> {
  const stateHunts = lists.states.flatMap(({ latest, previous }) =>
    [latest, previous].flatMap((state) =>
      (state?.hunts ?? []).map((h) => ({
        hunter: latest.pseudo,
        fieldGain: h.fieldGain,
        returnsAt: h.returnsAt.getTime(),
      })),
    ),
  );
  const floods = declared.floods
    .filter((f) => !floodCovered(f, lists.floods))
    .flatMap((f) =>
      Array.from({ length: f.attacks }, (_, i): AllianceFlood => ({
        from: f.from,
        target: f.target,
        at: f.at,
        take: null,
        army: null,
        fingerprint: `${f.fingerprint}:${String(i)}`,
        observedAt: 0,
        declared: true,
      })),
    );
  const convoys = declared.transits
    .filter((t) => !transitCovered(t, lists.convoys))
    .map((t): AllianceConvoy => ({
      kind: t.at > now.getTime() ? "transit" : "delivered",
      from: t.from,
      to: t.to,
      food: t.food,
      materials: t.materials,
      at: t.at,
      fingerprint: t.fingerprint,
      observedAt: 0,
      reporter: t.from,
      declared: true,
    }));
  const hunts = declared.hunts
    .filter((h) => !huntCovered(h, [...lists.hunts, ...stateHunts]))
    .map((h): AllianceHunt => ({
      hunter: h.hunter,
      fieldGain: h.fieldGain,
      returnsAt: h.returnsAt,
      ants: null,
      fingerprint: h.fingerprint,
      observedAt: 0,
      declared: true,
    }));
  return {
    floods: [...lists.floods, ...floods],
    convoys: [...lists.convoys, ...convoys],
    hunts: [...lists.hunts, ...hunts],
  };
}
