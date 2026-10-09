import { buildTabs, settingsTabs, TABS_STYLE } from "@/features/settings/dialog";
import { simulatorUrl } from "@/features/combat-simulator/open";
import { loadNotificationSettings, setNotification } from "@/features/alerts/notification-settings";
import { NOTIFICATIONS_PERMISSION, openGrantPage } from "@/features/alerts/permission";
import { loadToggles, setToggle } from "@/features/toggles";
import { PAGE_BASE_CSS, THEME_CSS } from "@/theme";

const style = document.createElement("style");
style.textContent = `
${THEME_CSS}
${PAGE_BASE_CSS}
.popup { width: 340px; padding-top: 8px; }
.tab-panel { padding: 12px 16px; }
${TABS_STYLE}`;
document.head.append(style);

const tabs = settingsTabs(
  browser.runtime.getManifest().version,
  navigator.userAgent,
  {
    toggles: await loadToggles(),
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
popup.className = "popup";
popup.append(buildTabs(document, tabs));
document.body.append(popup);
