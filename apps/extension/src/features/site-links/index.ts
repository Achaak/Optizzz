import { readAllianceRanking } from "@optizzz/game/pages/alliance-ranking";
import { readProfile } from "@optizzz/game/pages/scores";
import { siteServerPath } from "@optizzz/game/site-links/site";
import { addColonyMenuEntry } from "@/utils/alliance-menu";
import { SITE_ORIGIN } from "@/utils/site";
import type { Feature } from "../feature";
import { gameServerOf } from "../optizzz-account/offer";
import { mountAllianceSiteLink, mountProfileSiteLink } from "./mount";

// An arrow leaving a box: another site, in a new tab.
const SITE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none"
  stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>`;

/**
 * The way to optizzz.fr from the game: « Optizzz.fr » in the Fourmilière menu (the server's pages), « Voir sur
 * optizzz.fr » on profiles and alliance pages. Only on the servers the site follows. See docs/features/liens-site.md.
 */
export const siteLinks: Feature = {
  id: "site-links",
  toggle: "site-links",
  matches: () => true,
  async run() {
    const server = gameServerOf(location.origin);
    if (!server) return;
    addColonyMenuEntry(document, {
      className: "optizzz-site",
      href: `${SITE_ORIGIN}${siteServerPath(server.id)}`,
      label: "Optizzz.fr",
      icon: SITE_ICON,
      newTab: true,
    });

    const path = location.pathname.toLowerCase();
    if (path === "/membre.php") {
      const profile = readProfile(document);
      if (profile) await mountProfileSiteLink(document, location.origin, SITE_ORIGIN, server.id, profile.pseudo);
    }
    const tag = path === "/classementalliance.php" ? new URLSearchParams(location.search).get("alliance") : null;
    if (tag && readAllianceRanking(document)) mountAllianceSiteLink(document, SITE_ORIGIN, server.id, tag);
  },
};
