import { ABOUT_STYLE, buildAboutSection } from "./about-section";

export interface SettingsTab {
  id: string;
  label: string;
  render: (doc: Document) => HTMLElement;
}

/** Tabs of the dialog, in order. Settings and themes will get their own tabs here. */
export function settingsTabs(version: string, userAgent: string): SettingsTab[] {
  return [{ id: "about", label: "À propos", render: (doc) => buildAboutSection(doc, version, userAgent) }];
}

// Close to the game's panels: parchment background, olive title, small bold tabs.
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
.dialog-tabs { display: flex; gap: 2px; padding: 0 8px; border-bottom: 1px solid #a8894a; }
.dialog-tab {
  padding: 6px 12px; border: 1px solid transparent; border-bottom: none; border-radius: 3px 3px 0 0;
  background: #dcc78a; color: #4a4320; font: inherit; font-weight: bold; cursor: pointer;
}
.dialog-tab[aria-selected="true"] { background: #f7ecc6; border-color: #a8894a; margin-bottom: -1px; }
.dialog-body { overflow: auto; padding: 16px 20px; background: #f7ecc6; }
${ABOUT_STYLE}`;

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

  const tabList = doc.createElement("div");
  tabList.className = "dialog-tabs";
  tabList.setAttribute("role", "tablist");
  const body = doc.createElement("div");
  body.className = "dialog-body";
  body.setAttribute("role", "tabpanel");

  const buttons = tabs.map((tab) => {
    const button = doc.createElement("button");
    button.type = "button";
    button.className = "dialog-tab";
    button.setAttribute("role", "tab");
    button.textContent = tab.label;
    button.addEventListener("click", () => select(tab));
    tabList.append(button);
    return button;
  });

  function select(selected: SettingsTab) {
    tabs.forEach((tab, index) => buttons[index]?.setAttribute("aria-selected", String(tab === selected)));
    body.replaceChildren(selected.render(doc));
  }
  const first = tabs[0];
  if (first) select(first);

  dialog.append(header, tabList, body);
  return dialog;
}
