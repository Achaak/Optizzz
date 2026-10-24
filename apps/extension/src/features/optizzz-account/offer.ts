import { serverById, type GameServer } from "@optizzz/game/servers";
import { declinedKey, type AttachedPlayer } from "@/data/optizzz-account";

/** « Rattacher Pseudo (S5) à votre Compte Optizzz »: the Player of the server where one plays. */
export interface Offer {
  /** The game's origin, « https://s5.fourmizzz.fr ». */
  origin: string;
  server: GameServer;
  pseudo: string;
}

/** The game's server of an origin (« https://s5.fourmizzz.fr » → S5), or undefined for any other address. */
export function gameServerOf(origin: string): GameServer | undefined {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return undefined;
  }
  const [id, ...domain] = url.hostname.split(".");
  return domain.join(".") === "fourmizzz.fr" && id ? serverById(id) : undefined;
}

interface OfferInput {
  linked: boolean;
  /** The game's server where one plays, and the pseudo of its header; null when unknown. */
  origin: string | null;
  pseudo: string | null;
  attached: AttachedPlayer[];
  declined: string[];
}

/**
 * The offer to make once, when the extension is linked and the Player of the page is neither attached to the account
 * nor refused. Never without a linked account: nothing leaves the browser without one (ADR 0005).
 */
export function offerFor({ linked, origin, pseudo, attached, declined }: OfferInput): Offer | null {
  if (!linked || !origin || !pseudo) return null;
  const server = gameServerOf(origin);
  if (!server) return null;
  if (attached.some((player) => player.server === server.id && player.pseudo === pseudo)) return null;
  if (declined.includes(declinedKey(server.id, pseudo))) return null;
  return { origin, server, pseudo };
}
