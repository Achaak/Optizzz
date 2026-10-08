import { withToggle, type Toggles } from "../toggles";
import { ABOUT_STYLE, buildAboutSection } from "./about-section";
import { buildFeaturesSection, FEATURES_STYLE, type ToggleChange } from "./features-section";
import { buildNotificationsSection, NOTIFICATIONS_STYLE, type NotificationsTabInput } from "./notifications-section";
import { buildToolsSection, TOOLS_STYLE, type ToolsInput } from "./tools-section";

export interface SettingsTab {
  id: string;
  label: string;
  render: (doc: Document) => HTMLElement;
}

export interface FeaturesTabInput {
  toggles: Toggles;
  /** Saves a change; the tab keeps its own copy up to date for when it is shown again. */
  onChange: ToggleChange;
  /** Reloads the game page; absent in the toolbar popup. */
  reload?: () => void;
}

/** Tabs of the dialog and the popup, in order. Settings and themes will get their own tabs here. */
export function settingsTabs(
  version: string,
  userAgent: string,
  features: FeaturesTabInput,
  tools: ToolsInput,
  notifications: NotificationsTabInput,
): SettingsTab[] {
  let toggles = features.toggles;
  // Kept up to date, like the toggles, for when the tab is shown again.
  let notificationSettings = notifications.settings;
  const notificationsInput: NotificationsTabInput = {
    ...notifications,
    onChange: (kind, enabled) => {
      notificationSettings = { ...notificationSettings, [kind]: enabled };
      notifications.onChange(kind, enabled);
    },
  };
  const onChange: ToggleChange = (feature, option, enabled) => {
    toggles = withToggle(toggles, feature, option, enabled);
    features.onChange(feature, option, enabled);
  };
  return [
    {
      id: "features",
      label: "Fonctionnalités",
      render: (doc) => buildFeaturesSection(doc, toggles, onChange, features.reload),
    },
    {
      id: "notifications",
      label: "Notifications",
      render: (doc) => buildNotificationsSection(doc, { ...notificationsInput, settings: notificationSettings }),
    },
    { id: "tools", label: "Outils", render: (doc) => buildToolsSection(doc, tools) },
    { id: "about", label: "À propos", render: (doc) => buildAboutSection(doc, version, userAgent) },
  ];
}

// Small bold tabs, the selected one joined to the panel below. Shared with the toolbar popup.
export const TABS_STYLE = `
.tabs { display: flex; flex-direction: column; min-height: 0; }
.tab-list { display: flex; gap: 2px; padding: 0 8px; border-bottom: 1px solid #a8894a; }
.tab {
  padding: 6px 12px; border: 1px solid transparent; border-bottom: none; border-radius: 3px 3px 0 0;
  background: #dcc78a; color: #4a4320; font: inherit; font-weight: bold; cursor: pointer;
}
.tab[aria-selected="true"] { background: #f7ecc6; border-color: #a8894a; margin-bottom: -1px; }
.tab-panel { overflow: auto; padding: 16px 20px; background: #f7ecc6; }
${FEATURES_STYLE}
${NOTIFICATIONS_STYLE}
${TOOLS_STYLE}
${ABOUT_STYLE}`;

// Close to the game's panels: parchment background, olive title.
export const DIALOG_STYLE = `
.dialog {
  position: fixed; top: 100px; left: 50%; transform: translateX(-50%);
  width: 560px; max-width: calc(100vw - 32px); max-height: calc(100vh - 140px);
  display: flex; flex-direction: column; box-sizing: border-box;
  font-family: Verdana, Arial, sans-serif; font-size: 12px; color: #222;
  background: #efe0ad; border: 2px solid #a8894a; border-radius: 4px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
}
.dialog-header { position: relative; padding: 10px 40px 6px; text-align: center; }
.dialog-title { margin: 0; font-size: 18px; font-weight: normal; color: #6f6a1f; }
.dialog-close {
  position: absolute; top: 6px; right: 8px; width: 28px; height: 28px; padding: 0;
  border: none; background: none; color: #b49a55; font-size: 26px; line-height: 1; cursor: pointer;
}
.dialog-close:hover { color: #6f6a1f; }
${TABS_STYLE}`;

/** Tab list and panel, the first tab shown. */
export function buildTabs(doc: Document, tabs: SettingsTab[]): HTMLElement {
  const container = doc.createElement("div");
  container.className = "tabs";
  const tabList = doc.createElement("div");
  tabList.className = "tab-list";
  tabList.setAttribute("role", "tablist");
  const panel = doc.createElement("div");
  panel.className = "tab-panel";
  panel.setAttribute("role", "tabpanel");

  const buttons = tabs.map((tab) => {
    const button = doc.createElement("button");
    button.type = "button";
    button.className = "tab";
    button.setAttribute("role", "tab");
    button.textContent = tab.label;
    button.addEventListener("click", () => select(tab));
    tabList.append(button);
    return button;
  });

  function select(selected: SettingsTab) {
    tabs.forEach((tab, index) => buttons[index]?.setAttribute("aria-selected", String(tab === selected)));
    panel.replaceChildren(selected.render(doc));
  }
  const first = tabs[0];
  if (first) select(first);

  container.append(tabList, panel);
  return container;
}

/** Builds the settings dialog: title, close button, one tab per section. */
export function buildSettingsDialog(doc: Document, tabs: SettingsTab[], onClose: () => void): HTMLElement {
  const dialog = doc.createElement("div");
  dialog.className = "dialog";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-labelledby", "optizzz-settings-title");

  const header = doc.createElement("div");
  header.className = "dialog-header";
  const title = doc.createElement("h2");
  title.className = "dialog-title";
  title.id = "optizzz-settings-title";
  title.textContent = "Paramètres";
  const close = doc.createElement("button");
  close.type = "button";
  close.className = "dialog-close";
  close.title = "Fermer";
  close.setAttribute("aria-label", "Fermer");
  close.textContent = "×";
  close.addEventListener("click", onClose);
  header.append(title, close);

  dialog.append(header, buildTabs(doc, tabs));
  return dialog;
}
