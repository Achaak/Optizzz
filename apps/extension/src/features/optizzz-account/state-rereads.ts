// The pages a Production (and the Chasses, the Armée) needs, Ressources.php and colonies.php, read again when a game
// page opens and what was kept of them is older than 15 minutes, as the other features read their pages again
// (docs/features/site-envois.md, « Quand part un Envoi »). An opening of a page by the player, never a timer; the
// background sends the Envoi a few seconds after what is kept changes.
import { readLoggedInPseudo } from "@optizzz/game/pages/alliance";
import { keepStateOfPage, loadStatePages, PAGE_OF, wantedParts, type StatePart } from "@/data/state-pages";
import { fetchGamePage } from "@/utils/game-page";
import type { Feature } from "../feature";

/** Past this age, a page a state needs is read again at the next game page. */
export const STATE_PAGE_MAX_AGE = 15 * 60_000;

/** Only these: the others (Armee.php, construction.php, laboratoire.php) are kept when the player opens them. */
const REREAD: readonly Extract<StatePart, "ressources" | "colonies">[] = ["ressources", "colonies"];

/** Reads again the pages of `wanted` older than STATE_PAGE_MAX_AGE, except the one open (`path`, lower case). */
export async function rereadStatePages(
  origin: string,
  path: string,
  wanted: ReadonlySet<StatePart>,
  now: Date,
  fetchFn?: (url: string) => Promise<Response>,
): Promise<void> {
  const kept = await loadStatePages(origin);
  for (const part of REREAD) {
    const page = PAGE_OF[part];
    if (!wanted.has(part) || page.toLowerCase() === path) continue;
    if (now.getTime() - (kept[part]?.readAt ?? 0) < STATE_PAGE_MAX_AGE) continue;
    try {
      const doc = await fetchGamePage(`${origin}${page}`, fetchFn);
      if (doc) await keepStateOfPage(origin, doc, page.toLowerCase(), new Set([part]), now);
    } catch (error) {
      console.warn("[Optizzz] state Envois: a page could not be read again", error);
    }
  }
}

export const stateRereads: Feature = {
  id: "state-rereads",
  toggle: "optizzz-account",
  matches: () => true,
  async run() {
    const pseudo = readLoggedInPseudo(document);
    if (!pseudo) return;
    const wanted = await wantedParts(location.origin, pseudo);
    await rereadStatePages(location.origin, location.pathname.toLowerCase(), wanted, new Date());
  },
};
