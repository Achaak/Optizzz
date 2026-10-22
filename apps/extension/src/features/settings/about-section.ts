import iconSvg from "@/assets/icon.svg?raw";
import { bugReportUrl, featureRequestUrl, REPOSITORY_URL } from "./links";
import { svgElement } from "@/utils/html";

/** Styles of the « À propos » section, shared by the in-game dialog and the toolbar popup. */
export const ABOUT_STYLE = `
.about-header { display: flex; align-items: center; gap: var(--optizzz-space-5); }
.about-header svg { display: block; width: 48px; height: 48px; flex: none; }
.about-name { margin: 0; font-family: var(--optizzz-title-font); font-size: var(--optizzz-font-size-title-large); font-style: italic; font-weight: bold; color: var(--optizzz-title); }
.about-version { margin: var(--optizzz-space-1) 0 0; color: var(--optizzz-text-muted); font-size: var(--optizzz-font-size-small); font-variant-numeric: tabular-nums; }
.about-text { margin: var(--optizzz-space-5) 0; }
.about-links { list-style: none; padding: var(--optizzz-space-4) 0 0; margin: 0; display: grid; gap: var(--optizzz-space-3); border-top: 1px solid var(--optizzz-border-soft); }
.about-links a { color: var(--optizzz-link); text-underline-offset: 2px; }`;

/** « À propos » : name, version, source code and issue links (opened in a new tab). */
export function buildAboutSection(doc: Document, version: string, userAgent: string): HTMLElement {
  const section = doc.createElement("div");
  section.className = "about";

  const header = doc.createElement("div");
  header.className = "about-header";
  const icon = doc.createElement("span");
  icon.append(svgElement(doc, iconSvg));
  const name = doc.createElement("p");
  name.className = "about-name";
  name.textContent = "Optizzz";
  const versionLine = doc.createElement("p");
  versionLine.className = "about-version";
  versionLine.textContent = `Version ${version}`;
  const titles = doc.createElement("div");
  titles.append(name, versionLine);
  header.append(icon, titles);

  const text = doc.createElement("p");
  text.className = "about-text";
  text.textContent = "Outils pour le jeu Fourmizzz. Extension libre et gratuite, sans publicité.";

  const links = doc.createElement("ul");
  links.className = "about-links";
  for (const [label, href] of [
    ["Code source sur GitHub", REPOSITORY_URL],
    ["Signaler un bug", bugReportUrl(version, userAgent)],
    ["Proposer une fonctionnalité", featureRequestUrl()],
  ] as const) {
    const link = doc.createElement("a");
    link.href = href;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = label;
    const item = doc.createElement("li");
    item.append(link);
    links.append(item);
  }

  section.append(header, text, links);
  return section;
}
