import type { ContentScriptContext } from "wxt/utils/content-script-context";
import { readLoggedInPseudo } from "@/game/pages/alliance";
import { readAllianceRanking } from "@/game/pages/alliance-ranking";
import { readProfile } from "@/game/pages/scores";
import { insertMenuBarButton } from "@/utils/menu-bar";
import { createPageDialog } from "@/utils/page-dialog";
import type { Feature } from "../feature";
import { isEnabled } from "../toggles";
import { mountAllianceFollow, mountProfileFollow } from "./follow";
import { requestWatchlist, watchlistUrl } from "./open";
import { rememberServer } from "./reading";
import { WATCHLIST_HASH } from "./settings";

const WATCHLIST_BUTTON_CLASS = "optizzz-watchlist-button";

// An eye, drawn in the menu's link colour like the gear and the map.
const EYE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none"
  stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;

let shared: ReturnType<typeof createPageDialog> | undefined;

function watchlistDialog(ctx: ContentScriptContext) {
  shared ??= createPageDialog(ctx, {
    name: "optizzz-watchlist",
    title: "Suivis",
    src: () => watchlistUrl(location.origin, { embedded: true }),
    openInTab: () => requestWatchlist(location.origin),
  });
  return shared;
}

const failed = (error: unknown) => {
  console.error("[Optizzz] watch list dialog failed", error);
};

/**
 * The watch list: a top bar button opening « Suivis » over the game, « Suivre » on profiles and alliance pages,
 * the view opened by `#optizzz-suivis` (from a notification or the popup). See docs/features/suivis.md.
 */
export const watchlist: Feature = {
  id: "watchlist",
  toggle: "watchlist",
  matches: () => true,
  async run(ctx, toggles) {
    if (isEnabled(toggles, "watchlist", "button")) {
      insertMenuBarButton(document, {
        className: WATCHLIST_BUTTON_CLASS,
        title: "Suivis",
        label: "Suivis",
        icon: EYE_ICON,
        onClick: () => {
          watchlistDialog(ctx).toggle().catch(failed);
        },
      });
    }
    if (location.hash === `#${WATCHLIST_HASH}`) {
      history.replaceState(null, "", location.pathname + location.search);
      watchlistDialog(ctx).open(undefined).catch(failed);
    }

    if (isEnabled(toggles, "watchlist", "follow")) {
      const open = () => {
        watchlistDialog(ctx).open(undefined).catch(failed);
      };
      const path = location.pathname.toLowerCase();
      const profile = path === "/membre.php" ? readProfile(document) : null;
      if (profile)
        mountProfileFollow(document, location.origin, profile.pseudo, open).catch((error: unknown) => {
          console.warn("[Optizzz] watch list: players export unavailable", error);
        });
      const tag = path === "/classementalliance.php" ? new URLSearchParams(location.search).get("alliance") : null;
      if (tag && readAllianceRanking(document)) mountAllianceFollow(document, location.origin, tag, open);
    }

    await rememberServer(location.origin, readLoggedInPseudo(document));
  },
};
