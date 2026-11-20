import { loadPlayersExport } from "@/data/exports";
import { inactivityOf, loadRecentNights } from "@/data/nights";
import { allianceReach, mutualReach } from "@optizzz/game/analysis/reach";
import { readLoggedInPseudo } from "@optizzz/game/pages/alliance";
import { readStock } from "@optizzz/game/pages/resources";
import { readProfile } from "@optizzz/game/pages/scores";
import type { Feature } from "../feature";
import { isEnabled } from "../toggles";
import { ANALYSIS_BOX_STYLE, mountAnalysisBox, mountAnalysisRows, type ProfileAnalysis } from "./mount";
import { loadPlayerAnalysis } from "@/data/site-analysis";
import { periodRanks } from "@/features/history/series";
import { serverById } from "@optizzz/game/servers";
import { SITE_ORIGIN } from "@/utils/site";

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
    const showBox = isEnabled(toggles, "player-analysis", "panel");
    if (!showReach && !showInactivity && !showBox) return;

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

    if (!player) return;
    const nights =
      showInactivity || showBox
        ? await loadRecentNights(location.origin).catch((error: unknown) => {
            console.warn("[Optizzz] player analysis: nightly exports unavailable", error);
            return null;
          })
        : null;
    if (showInactivity && nights && !player.onHoliday && !player.isBanned) {
      analysis.inactivity = inactivityOf(nights, player.id, profile.scores);
      mountAnalysisRows(document, analysis);
    }
    const server = serverById(location.hostname.split(".")[0] ?? "");
    if (showBox && server) {
      const unavailable = new Set(
        players.filter((other) => other.onHoliday || other.isBanned).map((other) => other.id),
      );
      const style = document.createElement("style");
      style.textContent = ANALYSIS_BOX_STYLE;
      document.head.append(style);
      mountAnalysisBox(document, {
        analysis: await loadPlayerAnalysis(location.origin, player.id),
        rank: nights ? (periodRanks(nights, [player.id], unavailable).get(player.id) ?? null) : null,
        siteHref: `${SITE_ORIGIN}/${server.id}/players/${String(player.id)}`,
        now: new Date(),
      });
    }
  },
};
