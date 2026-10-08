// Optizzz's design tokens: the CSS variables of theme.css, and the same palette for what cannot read CSS (charts).
import themeCss from "./theme.css?raw";

export { themeCss as THEME_CSS };

const STYLE_ID = "optizzz-theme";

/** The body of the extension's own pages (popup, permission page, combat simulator), parchment like the game. */
export const PAGE_BASE_CSS = `body { margin: 0; background: var(--optizzz-surface); font-family: var(--optizzz-font);
  font-size: var(--optizzz-font-size); color: var(--optizzz-text); }`;

/** Defines the tokens on a game page, once, for the styles Optizzz adds to its DOM. */
export function injectTheme(doc: Document): void {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement("style");
  style.id = STYLE_ID;
  style.textContent = themeCss;
  doc.head.append(style);
}

/** Chart colours (ECharts draws on a canvas: it cannot read CSS variables). */
export const CHART_COLORS = {
  /** Series, in order: me first. */
  series: ["#c5130f", "#2e6da4", "#2f6b1a", "#c76b00", "#7a4a12", "#6b5d3a", "#8a3ea3", "#1d8a8a"],
  selected: "#c5130f",
  neighbor: "#c76b00",
  member: "#2e6da4",
  holiday: "#a0a0a0",
  link: "rgba(80, 80, 80, 0.35)",
  marker: "#7a4a12",
  text: "#000",
  muted: "#6b5d3a",
  grid: "rgba(102, 88, 50, 0.35)",
} as const;
