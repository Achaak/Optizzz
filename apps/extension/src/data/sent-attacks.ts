// The attacks on their way as the game last listed them (« Attaque(s) en cours », on Armee.php and the attack form),
// with the game's number of each one: kept by collect for the Floods Envoi only, when the logged-in player checked
// « Floods » (docs/features/site-envois.md). Never read for itself: a page the player opened shows it.
import type { SentAttack } from "@/features/flood/attacks";
import { storage } from "wxt/utils/storage";

export interface KeptSentAttacks {
  readAt: Date;
  attacks: SentAttack[];
}

interface Stored {
  readAt: number;
  attacks: (Omit<SentAttack, "arrivesAt"> & { arrivesAt: number })[];
}

const sentAttacksKey = (origin: string) => `local:sentAttacks:${new URL(origin).host}` as const;

export async function storeSentAttacks(origin: string, attacks: readonly SentAttack[], readAt: Date): Promise<void> {
  await storage.setItem<Stored>(sentAttacksKey(origin), {
    readAt: readAt.getTime(),
    attacks: attacks.map(({ attackId, target, arrivesAt }) => ({ attackId, target, arrivesAt: arrivesAt.getTime() })),
  });
}

export async function loadSentAttacks(origin: string): Promise<KeptSentAttacks | null> {
  const stored = await storage.getItem<Stored>(sentAttacksKey(origin));
  if (!stored) return null;
  return {
    readAt: new Date(stored.readAt),
    attacks: stored.attacks.map((attack) => ({ ...attack, arrivesAt: new Date(attack.arrivesAt) })),
  };
}
