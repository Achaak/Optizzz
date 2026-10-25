// The Convois category of the Envois (docs/features/site-envois.md): one encrypted row per convoy, on its way or
// delivered, as the extension of its sender or of its recipient read it on commerce.php and in the inbox. A convoy
// seen by both sides has the same identity on both, so that its fingerprint, keyed with the Clé d'alliance, is the
// same: it counts once.
import { z } from "zod";

const DAY = 24 * 3600_000;

/** How long the site keeps a convoy (site-optizzz.md, « Conservation »). */
export const CONVOYS_KEPT_MS = 90 * DAY;

export const CONVOY_ITEM = z.object({
  /** On its way (commerce.php) or delivered (the inbox's « Convoi livré à X » / « Convoi reçu de X »). */
  kind: z.enum(["transit", "delivered"]),
  from: z.string().min(1).max(40),
  to: z.string().min(1).max(40),
  food: z.number().int().nonnegative(),
  materials: z.number().int().nonnegative(),
  /** Milliseconds since 1970: the arrival, to come or past. */
  at: z.number().int().nonnegative(),
});

export type ConvoyItem = z.infer<typeof CONVOY_ITEM>;

/** One convoy to send: its identity (what the fingerprint is drawn from), the item, and when the site forgets it. */
export interface ConvoyEnvoiItem {
  identity: string;
  item: ConvoyItem;
  expiresAt: number;
}

export interface ConvoysKept {
  server: string;
  /** The Joueur whose extension read them. */
  me: string;
  outgoing: readonly { recipient: string; food: number; materials: number; arrivesAt: Date }[];
  incoming: readonly { sender: string; food: number; materials: number; arrivesAt: Date }[];
  history: readonly { direction: "sent" | "received"; player: string; food: number; materials: number; at: Date }[];
}

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/**
 * The identity of a convoy, the same for its sender and its recipient. A delivery is dated by the game to the minute,
 * in the inbox of both. A convoy on its way is not: each side counts its arrival from its own clock. Its identity
 * leaves the time out, and numbers the identical convoys between the same two players in the order they arrive.
 */
function identities(server: string, items: readonly ConvoyItem[]): string[] {
  const base = (item: ConvoyItem) =>
    [item.kind, server, item.from.toLowerCase(), item.to.toLowerCase(), item.food, item.materials].join("|");
  const order = items.map((item, index) => ({ item, index })).sort((a, b) => a.item.at - b.item.at);
  const rank = new Map<number, number>();
  const seen = new Map<string, number>();
  for (const { item, index } of order) {
    if (item.kind !== "transit") continue;
    const key = base(item);
    const n = seen.get(key) ?? 0;
    seen.set(key, n + 1);
    rank.set(index, n);
  }
  return items.map((item, index) =>
    item.kind === "transit" ? `${base(item)}|#${String(rank.get(index) ?? 0)}` : `${base(item)}|${String(item.at)}`,
  );
}

/** What the extension kept of a Joueur's convoys, as Envoi items. */
export function convoyEnvoiItems(kept: ConvoysKept): ConvoyEnvoiItem[] {
  const { me } = kept;
  const items: ConvoyItem[] = [
    ...kept.outgoing.map((c) => ({
      kind: "transit" as const,
      from: me,
      to: c.recipient,
      food: c.food,
      materials: c.materials,
      at: c.arrivesAt.getTime(),
    })),
    ...kept.incoming.map((c) => ({
      kind: "transit" as const,
      from: c.sender,
      to: me,
      food: c.food,
      materials: c.materials,
      at: c.arrivesAt.getTime(),
    })),
    ...kept.history.map((m) => ({
      kind: "delivered" as const,
      from: m.direction === "sent" ? me : m.player,
      to: m.direction === "sent" ? m.player : me,
      food: m.food,
      materials: m.materials,
      at: m.at.getTime(),
    })),
  ];
  const ids = identities(kept.server, items);
  return items.map((item, index) => ({ identity: ids[index] ?? "", item, expiresAt: item.at + CONVOYS_KEPT_MS }));
}

/** The convoys still on their way to `me` from someone else, soonest first. */
export function convoysToward<T extends ConvoyItem>(me: string, now: Date, convoys: readonly T[]): T[] {
  return convoys
    .filter((c) => c.kind === "transit" && same(c.to, me) && !same(c.from, me) && c.at > now.getTime())
    .sort((a, b) => a.at - b.at);
}
