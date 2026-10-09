import iconSvg from "@/assets/icon.svg?raw";
import { bugReportUrl, featureRequestUrl, REPOSITORY_URL } from "./links";
import { svgElement } from "@/utils/html";

/** Styles of the « À propos » section, shared by the in-game dialog and the toolbar popup. */
export const ABOUT_STYLE = `
.about-header { display: flex; align-items: center; gap: 10px; }
.about-header svg { width: 40px; height: 40px; flex: none; }
.about-name { font-size: 15px; font-weight: bold; margin: 0; }
.about-version { color: var(--optizzz-text-muted); font-size: 11px; margin: 2px 0 0; }
.about-text { margin: 10px 0; }
.about-links { list-style: none; padding: 0; margin: 0; display: grid; gap: 6px; }
.about-links a { color: var(--optizzz-link); }`;

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
