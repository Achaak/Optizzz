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

/**
 * Chart colours (ECharts draws on a canvas: it cannot read CSS variables). Chosen for colour blindness, checked on the
 * raised parchment: two neighbours of `series` stay apart for a red-green colour blindness (protanopia,
 * deuteranopia), and so do its first three all together. Never red against green alone: see docs/adr/0003-daltonisme.md.
 */
export const CHART_COLORS = {
  /** Series, in order: me first. Red, blue, gold, brown, sky, orange, violet, green. */
  series: ["#c5130f", "#0a5fa8", "#b88600", "#7d4800", "#2b86c4", "#b35900", "#5a3a9e", "#00785a"],
  selected: "#c5130f",
  /** Apart from `selected` and `member` with a colour blindness (an orange would read as the red). */
  neighbor: "#b88600",
  member: "#0a5fa8",
  holiday: "#a0a0a0",
  link: "rgba(80, 80, 80, 0.35)",
  marker: "#7d4800",
  text: "#241c0c",
  muted: "#5a4c2e",
  grid: "rgba(102, 88, 50, 0.35)",
  /** Outline of labels drawn over points: the raised parchment of the chart box. */
  halo: "#f3ead0",
  /** Every player of the server under the ones chosen (server map). */
  background: "rgba(107, 93, 58, 0.2)",
  /** Chips of the server map: the series but red (me), then a near black. My alliance is `member`. */
  chips: ["#0a5fa8", "#b88600", "#7d4800", "#2b86c4", "#b35900", "#5a3a9e", "#00785a", "#2e2e2e"],
  /** Pacts and wars each get a family of hues: blues against reds and oranges, never greens against reds. */
  allies: ["#2b86c4", "#1d6f8a", "#4b5bb5", "#3d9ad6", "#173f7a", "#0a5fa8"],
  enemies: ["#c5130f", "#b35900", "#e0452b", "#a33b00", "#b88600", "#9c1f4a"],
} as const;
