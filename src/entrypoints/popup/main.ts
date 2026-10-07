import { buildTabs, settingsTabs, TABS_STYLE } from "@/features/settings/dialog";
import { loadToggles, setToggle } from "@/features/toggles";

const style = document.createElement("style");
style.textContent = `
body { margin: 0; background: #efe0ad; }
.popup { width: 340px; padding-top: 8px; font-family: Verdana, Arial, sans-serif; font-size: 12px; color: #222; }
.tab-panel { padding: 12px 16px; }
${TABS_STYLE}`;
document.head.append(style);

const tabs = settingsTabs(browser.runtime.getManifest().version, navigator.userAgent, {
  toggles: await loadToggles(),
  onChange: (feature, option, enabled) => {
    setToggle(feature, option, enabled).catch((error: unknown) => {
      console.error("[Optizzz] saving a feature toggle failed", error);
    });
  },
});

const popup = document.createElement("main");
popup.className = "popup";
popup.append(buildTabs(document, tabs));
document.body.append(popup);
