// The convoys attached to a Demande (docs/features/site-demandes.md, « Rattacher un convoi »). « Envoyer un convoi »
// opens the game's Convoi page filled for a Demande and notes it (an intent); the player clicks « Lancer le convoi »
// themself, the game lists the new convoy on commerce.php, and the next list kept attaches it to the Demande. Only its
// sender knows a convoy was for a Demande: their extension sends it in the Envoi category `demande-convoys`.
import { DEMANDES_KEPT_MS, type DemandeConvoy } from "@optizzz/game/site-links/demandes";
import type { ConvoySignature, DemandeConvoys } from "@/data/demandes";

/** A Convoi page opened from a Demande waits this long for the convoy launched from it. */
const INTENT_MS = 30 * 60_000;
/** Two readings of one convoy's arrival differ by the seconds between page loads. */
const SAME_ARRIVAL_MS = 2 * 60_000;

/** The convoys on their way the game last listed (commerce.php), and when. */
export interface OutgoingList {
  readAt: number;
  convoys: readonly (ConvoySignature & { recipient: string })[];
}

const sameName = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const same = (a: ConvoySignature, b: ConvoySignature) =>
  a.food === b.food && a.materials === b.materials && Math.abs(a.at - b.at) <= SAME_ARRIVAL_MS;

/**
 * Attaches the convoys launched from a Convoi page opened for a Demande: the latest new one toward its requester in a
 * list read since the page opened (not one already on its way then, nor one already attached). Drops what waited too
 * long, the attached convoys gone from the list before their arrival (cancelled in the game), and those 90 days past
 * their arrival.
 */
export function attachLaunched(
  kept: DemandeConvoys,
  outgoing: OutgoingList | null,
  now: number,
  newId: () => string,
): DemandeConvoys {
  const convoys = kept.convoys.filter((convoy) => {
    if (convoy.at + DEMANDES_KEPT_MS <= now) return false;
    if (!outgoing || convoy.at <= outgoing.readAt || outgoing.readAt < convoy.attachedAt) return true;
    return outgoing.convoys.some((c) => sameName(c.recipient, convoy.to) && same(c, convoy));
  });
  const intents = [];
  for (const intent of [...kept.intents].sort((a, b) => a.openedAt - b.openedAt)) {
    if (intent.openedAt + INTENT_MS <= now) continue;
    const launched =
      outgoing && outgoing.readAt >= intent.openedAt
        ? outgoing.convoys
            .filter(
              (c) =>
                sameName(c.recipient, intent.recipient) &&
                c.at > outgoing.readAt &&
                !intent.before.some((b) => same(b, c)) &&
                !convoys.some((a) => sameName(a.to, c.recipient) && same(a, c)),
            )
            .sort((a, b) => b.at - a.at)[0]
        : undefined;
    if (!launched) {
      intents.push(intent);
      continue;
    }
    convoys.push({
      id: newId(),
      demande: intent.demande,
      to: intent.recipient,
      food: launched.food,
      materials: launched.materials,
      at: launched.at,
      attachedAt: now,
    });
  }
  return { intents, convoys };
}

/** The convoys attached to Demandes, as items of the Envoi `demande-convoys`. */
export function demandeConvoyItems(
  server: string,
  me: string,
  kept: DemandeConvoys,
): { identity: string; item: DemandeConvoy; expiresAt: number }[] {
  return kept.convoys.map(({ id, demande, to, food, materials, at }) => ({
    identity: `demande-convoy|${server}|${id}`,
    item: { demande, from: me, to, food, materials, at },
    expiresAt: at + DEMANDES_KEPT_MS,
  }));
}
