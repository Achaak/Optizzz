import { buildTabs, settingsTabs, TABS_STYLE } from "@/features/settings/dialog";
import { simulatorUrl } from "@/features/combat-simulator/open";
import { serverMapUrl } from "@/features/server-map/open";
import { loadLastServer } from "@/features/server-map/settings";
import { loadNotificationSettings, setNotification } from "@/features/alerts/notification-settings";
import { NOTIFICATIONS_PERMISSION, openGrantPage } from "@/features/alerts/permission";
import { isEnabled, loadToggles, setToggle } from "@/features/toggles";
import { buildWatchSummary, loadWatchSummaries, WATCH_SUMMARY_STYLE } from "@/features/watchlist/popup";
import { watchlistPageUrl } from "@/features/watchlist/settings";
import { PAGE_BASE_CSS, THEME_CSS } from "@/theme";

const style = document.createElement("style");
style.textContent = `
${THEME_CSS}
${PAGE_BASE_CSS}
.popup { width: 380px; padding-top: var(--optizzz-space-4); }
${TABS_STYLE}
.tab-panel { padding: var(--optizzz-space-5) var(--optizzz-space-6); }
/* The four tabs on one line. */
.tab-list { padding: 0 var(--optizzz-space-3); }
.tab { padding: var(--optizzz-space-3) var(--optizzz-space-4); }
${WATCH_SUMMARY_STYLE}`;
document.head.append(style);

const toggles = await loadToggles();
const tabs = settingsTabs(
  browser.runtime.getManifest().version,
  navigator.userAgent,
  {
    toggles,
    onChange: (feature, option, enabled) => {
      setToggle(feature, option, enabled).catch((error: unknown) => {
        console.error("[Optizzz] saving a feature toggle failed", error);
      });
    },
  },
  {
    openSimulator: () => {
      // No server here: the page takes the one whose army was read last.
      void browser.tabs.create({ url: simulatorUrl(null, "attack") }).then(() => {
        window.close();
      });
    },
    openServerMap: () => {
      // No server here: the page takes the one of the last game tab.
      void browser.tabs.create({ url: serverMapUrl(null, null) }).then(() => {
        window.close();
      });
    },
    openWatchlist: () => {
      // The game on « Suivis », for the server of the last game tab; without one, the page says where to open it.
      void loadLastServer()
        .then((origin) =>
          browser.tabs.create({ url: origin ? watchlistPageUrl(origin) : browser.runtime.getURL("/watchlist.html") }),
        )
        .then(() => {
          window.close();
        });
    },
  },
  {
    settings: await loadNotificationSettings(),
    permitted: () => browser.permissions.contains(NOTIFICATIONS_PERMISSION),
    onChange: (kind, enabled) => {
      setNotification(kind, enabled).catch((error: unknown) => {
        console.error("[Optizzz] saving a notification setting failed", error);
      });
    },
    // A tab rather than asking here: on Firefox the prompt closes the popup and loses the answer.
    grant: () => {
      void openGrantPage().then(() => {
        window.close();
      });
    },
  },
);

const popup = document.createElement("main");
popup.className = "popup optizzz-popup";
// What changed among the watched players and alliances, above the settings.
const summary = isEnabled(toggles, "watchlist", "popup")
  ? buildWatchSummary(document, await loadWatchSummaries(new Date()), (origin) => {
      void browser.tabs.create({ url: watchlistPageUrl(origin) }).then(() => {
        window.close();
      });
    })
  : null;
if (summary) popup.append(summary);
popup.append(buildTabs(document, tabs));
document.body.append(popup);
