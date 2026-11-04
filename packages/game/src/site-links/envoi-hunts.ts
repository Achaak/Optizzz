// The hunts log of the Envois (docs/features/site-envois.md, « Chasses par membre »): one encrypted row per hunt seen
// out on Ressources.php, with its return, its gain and the ants sent (Compte+ only). It leaves with « Chasses » as soon
// as the hunt is seen and is never sealed again; the site counts it back at its return, and keeps it 90 days after.
// Its identity is the game's number for the hunt (`span#chasse_<n>`), the same at each reading.
import { z } from "zod";

const DAY = 24 * 3600_000;

/** The category of the hunts log, sent with « Chasses ». */
export const HUNTS_LOG = "hunts-log";

/** How long the site keeps a hunt: until 90 days after its return. */
export const HUNTS_LOG_KEPT_MS = 90 * DAY;

export const HUNT_ITEM = z.object({
  /** The member who sent the hunt. */
  hunter: z.string().min(1).max(40),
  /** Milliseconds since 1970: the return. */
  returnsAt: z.number().int().nonnegative(),
  /** The cm² the hunt brings back. */
  fieldGain: z.number().int().nonnegative(),
  /** The ants sent, all units together; null without Compte+ (Ressources.php does not list them). */
  ants: z.number().int().nonnegative().nullable(),
});

export type HuntItem = z.infer<typeof HUNT_ITEM>;

/** One hunt to send: its identity (what the fingerprint is drawn from), the item, the site's date. */
export interface HuntEnvoiItem {
  identity: string;
  item: HuntItem;
  expiresAt: number;
}

export interface HuntsKept {
  server: string;
  /** The Joueur whose extension read them: the hunter. */
  me: string;
  hunts: readonly { huntId: number; returnsAt: Date; fieldGain: number; ants: number | null }[];
}

/** « chasse_139778 » → 139778: the game's number for the hunt; null for another id. */
export function huntIdOf(countdownId: string): number | null {
  const match = /^chasse_(\d+)$/.exec(countdownId);
  return match?.[1] ? Number(match[1]) : null;
}

/** What the extension kept of a Joueur's hunts out, as Envoi items. */
export function huntEnvoiItems(kept: HuntsKept): HuntEnvoiItem[] {
  return kept.hunts.map((hunt) => ({
    identity: ["hunt", kept.server, String(hunt.huntId)].join("|"),
    item: { hunter: kept.me, returnsAt: hunt.returnsAt.getTime(), fieldGain: hunt.fieldGain, ants: hunt.ants },
    expiresAt: hunt.returnsAt.getTime() + HUNTS_LOG_KEPT_MS,
  }));
}
