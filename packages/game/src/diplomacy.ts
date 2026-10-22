// Pacts and wars between alliances, from the alliances export. See docs/research/fourmizzz-api-exports.md: a war is
// declared by one side only, and war tags do not always share the alliances' case.
import type { Alliance } from "./exports";

/** Who declared a war, from my alliance's side: both when each declared it on the other. */
export type WarSide = "us" | "them" | "both";

/** How the player reads a war, short (« Guerre déclarée ») and explained. */
export const WAR_LABELS: Record<WarSide, string> = {
  us: "Guerre déclarée",
  them: "Guerre subie",
  both: "Guerre réciproque",
};
export const WAR_TITLES: Record<WarSide, string> = {
  us: "Votre alliance lui a déclaré la guerre.",
  them: "Cette alliance a déclaré la guerre à la vôtre.",
  both: "Vos deux alliances se sont déclaré la guerre.",
};

export type Diplomacy = { kind: "pact"; name: string; description: string } | { kind: "war"; declaredBy: WarSide };

export const sameTag = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** Pact or war between two alliances; none between an alliance and itself (some are « at war » with themselves). */
export function diplomacyWith(mine: Alliance | undefined, theirs: Alliance | undefined): Diplomacy | null {
  if (!mine || !theirs || sameTag(mine.tag, theirs.tag)) return null;
  const pact = mine.diplomacy.pacts.find((p) => sameTag(p.tag, theirs.tag));
  if (pact) return { kind: "pact", name: pact.name.trim(), description: pact.description.trim() };
  const declares = (from: Alliance, to: Alliance) => from.diplomacy.wars.some((tag) => sameTag(tag, to.tag));
  const ours = declares(mine, theirs);
  const theirsOn = declares(theirs, mine);
  if (!ours && !theirsOn) return null;
  return { kind: "war", declaredBy: ours && theirsOn ? "both" : ours ? "us" : "them" };
}

/** Tags of the alliances my alliance has a pact with, and of those at war with it, as the export writes them. */
export function diplomaticCamps(myTag: string, alliances: readonly Alliance[]): { pacts: string[]; wars: string[] } {
  const mine = alliances.find((alliance) => sameTag(alliance.tag, myTag));
  const camps = { pacts: [] as string[], wars: [] as string[] };
  for (const alliance of alliances) {
    const diplomacy = diplomacyWith(mine, alliance);
    if (diplomacy?.kind === "pact") camps.pacts.push(alliance.tag);
    else if (diplomacy?.kind === "war") camps.wars.push(alliance.tag);
  }
  return camps;
}
