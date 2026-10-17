import { withToggle, type Toggles } from "../toggles";
import { svgElement } from "@/utils/html";
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
      render: (doc) =>
        buildNotificationsSection(doc, { ...notificationsInput, settings: notificationSettings, toggles }),
    },
    { id: "tools", label: "Outils", render: (doc) => buildToolsSection(doc, tools) },
    { id: "about", label: "À propos", render: (doc) => buildAboutSection(doc, version, userAgent) },
  ];
}

// Small bold tabs, the selected one joined to the panel below. Shared with the toolbar popup.
export const TABS_STYLE = `
.tabs { display: flex; flex-direction: column; flex: 1; min-height: 0; }
.tab-list { display: flex; gap: var(--optizzz-space-1); padding: 0 var(--optizzz-space-4); border-bottom: 1px solid var(--optizzz-border); }
.tab {
  padding: var(--optizzz-space-3) var(--optizzz-space-5); border: 1px solid transparent; border-bottom: none;
  border-radius: var(--optizzz-radius-small) var(--optizzz-radius-small) 0 0;
  background: var(--optizzz-surface-alt); color: var(--optizzz-text-muted); font: inherit; font-weight: bold;
  white-space: nowrap; filter: none; cursor: pointer;
}
.tab:hover { color: var(--optizzz-text); background: var(--optizzz-surface-tint); }
.tab[aria-selected="true"] { color: var(--optizzz-text); background: var(--optizzz-surface-raised); border-color: var(--optizzz-border); margin-bottom: -1px; }
.tab-panel { flex: 1; min-height: 0; overflow: auto; padding: var(--optizzz-space-6); background: var(--optizzz-surface-raised); }
${FEATURES_STYLE}
${NOTIFICATIONS_STYLE}
${TOOLS_STYLE}
${ABOUT_STYLE}`;

// Close to the game's panels: parchment background, red title (theme tokens, src/theme).
export const DIALOG_STYLE = `
.dialog {
  position: fixed; top: 100px; left: 50%; transform: translateX(-50%);
  /* A fixed height: going from one tab to another does not make the window jump. */
  width: 560px; max-width: calc(100vw - 32px); height: 640px; max-height: calc(100vh - 140px);
  display: flex; flex-direction: column; box-sizing: border-box; overflow: hidden;
  font-family: var(--optizzz-font); font-size: var(--optizzz-font-size); line-height: var(--optizzz-line-height); color: var(--optizzz-text);
  background: var(--optizzz-surface); border: 2px solid var(--optizzz-border); border-radius: var(--optizzz-radius);
  box-shadow: var(--optizzz-shadow);
}
.dialog-header { position: relative; padding: var(--optizzz-space-5) 44px var(--optizzz-space-4); text-align: center; }
.dialog-title { margin: 0; font-family: var(--optizzz-title-font); font-size: var(--optizzz-font-size-title-large); font-weight: bold; font-style: italic; line-height: 1.25; color: var(--optizzz-title); }
.dialog-close {
  position: absolute; top: var(--optizzz-space-4); right: var(--optizzz-space-4); display: grid; place-items: center;
  width: 28px; height: 28px; padding: 0; border: none; border-radius: var(--optizzz-radius-control);
  background: none; color: var(--optizzz-text-muted); filter: none; cursor: pointer;
}
.dialog-close svg { width: 16px; height: 16px; }
.dialog-close:hover { color: var(--optizzz-text); background: var(--optizzz-surface-alt); }
/* The reload notice of « Fonctionnalités », as a footer: flush with the bottom of the scrolling tab, edge to edge. */
.dialog .features-reload {
  bottom: calc(-1 * var(--optizzz-space-6)); margin: var(--optizzz-space-4) calc(-1 * var(--optizzz-space-6)) calc(-1 * var(--optizzz-space-6));
  padding: var(--optizzz-space-4) var(--optizzz-space-6); border-width: 1px 0 0; border-radius: 0; box-shadow: none;
}
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
  panel.id = "optizzz-tab-panel";
  panel.setAttribute("role", "tabpanel");

  const buttons = tabs.map((tab, index) => {
    const button = doc.createElement("button");
    button.type = "button";
    button.className = "tab";
    button.id = `optizzz-tab-${tab.id}`;
    button.setAttribute("role", "tab");
    button.setAttribute("aria-controls", panel.id);
    button.textContent = tab.label;
    button.addEventListener("click", () => select(tab));
    // Left and right arrows move between the tabs, as in any tab list.
    button.addEventListener("keydown", (event) => {
      const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
      const next = tabs[(index + step + tabs.length) % tabs.length];
      if (step === 0 || !next) return;
      event.preventDefault();
      select(next);
      buttons[tabs.indexOf(next)]?.focus();
    });
    tabList.append(button);
    return button;
  });

  function select(selected: SettingsTab) {
    tabs.forEach((tab, index) => {
      const button = buttons[index];
      button?.setAttribute("aria-selected", String(tab === selected));
      // Only the selected tab is in the Tab order; the arrows reach the others.
      if (button) button.tabIndex = tab === selected ? 0 : -1;
    });
    panel.setAttribute("aria-labelledby", `optizzz-tab-${selected.id}`);
    panel.replaceChildren(selected.render(doc));
  }
  const first = tabs[0];
  if (first) select(first);

  container.append(tabList, panel);
  return container;
}

// A cross drawn with the gear's stroke (menu-button.ts) rather than a « × » glyph.
const CLOSE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
  stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>`;

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
  close.append(svgElement(doc, CLOSE_ICON));
  close.addEventListener("click", onClose);
  header.append(title, close);

  dialog.append(header, buildTabs(doc, tabs));
  return dialog;
}
