import { loadPlayersExport } from "@/data/exports";
import { inactivityOf, loadRecentNights } from "@/data/nights";
import { allianceReach, mutualReach } from "@optizzz/game/analysis/reach";
import { readLoggedInPseudo } from "@optizzz/game/pages/alliance";
import { readStock } from "@optizzz/game/pages/resources";
import { readProfile } from "@optizzz/game/pages/scores";
import type { Feature } from "../feature";
import { isEnabled } from "../toggles";
import { mountAnalysisRows, type ProfileAnalysis } from "./mount";

const samePseudo = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/**
 * On Membre.php, under « Etat »: whether each can attack the other, how the player stands against my alliance, and
 * a probable inactivity. Nothing on my own profile. See docs/features/analyse-joueurs.md.
 */
export const playerAnalysis: Feature = {
  id: "player-analysis",
  toggle: "player-analysis",
  matches: (url) => url.pathname.toLowerCase() === "/membre.php",
  async run(_ctx, toggles) {
    const profile = readProfile(document);
    const me = readLoggedInPseudo(document);
    if (!profile || !me || samePseudo(profile.pseudo, me)) return;
    const showReach = isEnabled(toggles, "player-analysis", "reach");
    const showInactivity = isEnabled(toggles, "player-analysis", "inactivity");
    if (!showReach && !showInactivity) return;

    const players = (await loadPlayersExport(location.origin)).players;
    const player = players.find((candidate) => samePseudo(candidate.pseudo, profile.pseudo));
    const mine = players.find((candidate) => samePseudo(candidate.pseudo, me));
    const myField = readStock(document)?.huntingField ?? mine?.field;
    const theirField = profile.scores.field ?? player?.field;

    const analysis: ProfileAnalysis = { reach: null, alliance: null, inactivity: null };
    if (showReach && myField !== undefined && theirField !== undefined) {
      analysis.reach = mutualReach(myField, theirField);
      if (player && mine?.alliance) {
        const tag = mine.alliance.toLowerCase();
        const members = players
          .filter((member) => member.alliance?.toLowerCase() === tag && member.id !== player.id)
          .filter((member) => !member.onHoliday && !member.isBanned)
          .map((member) => ({ ...member, field: member.id === mine.id ? myField : member.field }));
        analysis.alliance = allianceReach({ ...player, field: theirField }, members);
      }
    }
    mountAnalysisRows(document, analysis);

    if (showInactivity && player && !player.onHoliday && !player.isBanned) {
      try {
        analysis.inactivity = inactivityOf(await loadRecentNights(location.origin), player.id, profile.scores);
        mountAnalysisRows(document, analysis);
      } catch (error) {
        console.warn("[Optizzz] player analysis: nightly exports unavailable", error);
      }
    }
  },
};
