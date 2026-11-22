import { rolesTopDown } from "@/features/tdc-chain/role-styles";
import { roleKey, roleLabel, rungPlaceArrow, rungPlaceText } from "@optizzz/game/tdc-chain/roles";
import { formatCompact, formatDecimal, formatNumber } from "@optizzz/game/format/number-format";
import { formatDuration, formatEndTime } from "@optizzz/game/format/time-format";
import type { MemberRole } from "./roles";
import type { MemberTrip } from "./trips";

const PSEUDO_CELL = 3;
export const COLUMN_CLASS = "optizzz-members-column";
/** My row, highlighted. */
export const ME_CLASS = "optizzz-members-me";

// The game's own header classes for its sort arrows (fdTableSort, restyled by the game look).
const ASCENDING = "forwardSort";
const DESCENDING = "reverseSort";

export const MEMBERS_COLUMNS_STYLE = `
th.${COLUMN_CLASS} a { cursor: pointer; }
#tabMembresAlliance .optizzz-members-trips { text-align: right; white-space: nowrap; }
#tabMembresAlliance .optizzz-members-roles { text-align: left; }
#tabMembresAlliance .optizzz-hidden-column { display: none; }
.optizzz-columns-picker { margin: 0 0 var(--optizzz-space-3); font-size: var(--optizzz-font-size-small); text-align: left; }
.optizzz-columns-picker summary { cursor: pointer; font-weight: 600; }
.optizzz-columns-picker label { display: inline-flex; align-items: center; gap: var(--optizzz-space-2); margin: var(--optizzz-space-2) var(--optizzz-space-4) 0 0; cursor: pointer; }
#tabMembresAlliance .optizzz-members-today, #tabMembresAlliance .optizzz-members-week { text-align: right; white-space: nowrap; }
#tabMembresAlliance .optizzz-members-none { color: var(--optizzz-text-muted); font-size: var(--optizzz-font-size-small); }
#tabMembresAlliance tr.${ME_CLASS} > td { background-color: var(--optizzz-surface-tint); }
#tabMembresAlliance tr.${ME_CLASS} > td:first-child { box-shadow: inset 3px 0 0 var(--optizzz-title); }
.optizzz-members-role { display: inline-flex; align-items: center; gap: var(--optizzz-space-3); padding: 1px 9px 1px 7px;
  font-size: var(--optizzz-font-size-small); font-weight: 600; white-space: nowrap; border-radius: var(--optizzz-radius-pill);
  background: color-mix(in srgb, var(--role-color) 14%, transparent);
  border: 1px solid color-mix(in srgb, var(--role-color) 45%, transparent); }
.optizzz-members-role::before { content: ""; width: 9px; height: 9px; border-radius: 50%; background: var(--role-color); }
.optizzz-members-role[data-shape="square"]::before { border-radius: 2px; }
.optizzz-members-role[data-shape="diamond"]::before { border-radius: 0; clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%); }
.optizzz-members-role[data-shape="triangle"]::before { border-radius: 0; clip-path: polygon(50% 0, 100% 100%, 0 100%); }
.optizzz-members-role[data-shape="arrow"]::before { border-radius: 0; clip-path: polygon(0 0, 100% 0, 50% 100%); }
.optizzz-members-role[data-shape="pin"]::before { border-radius: 2px; background: none; border: 2px solid var(--role-color); width: 5px; height: 5px; }`;

export interface MembersColumnsContext {
  myPseudo: string;
  /** The « Trajet » column; absent when switched off. `byPseudo` is null when the trips cannot be known. */
  trips?: { byPseudo: Map<string, MemberTrip> | null; missing?: string };
  /** The « Rôle » column: each member's chain role and its bubble, by lowercase nickname; absent when switched off. */
  roles?: Map<string, MemberRole>;
  /** The « Aujourd'hui » and « 7 j » columns, by lowercase nickname; absent when switched off. */
  evolution?: Map<string, MemberEvolution>;
}

/** A member's live field, and its field at the last midnight export and at the one a week before; null: unknown. */
export interface MemberEvolution {
  live: number;
  midnight: number | null;
  weekAgo: number | null;
}

interface Column {
  /** Class of its cells: `optizzz-members-<kind>`. */
  kind: "trips" | "roles" | "today" | "week";
  title: string;
  hint: string;
  /** Fills the cell of a member and gives its sort value; null when unknown, always last. */
  fill: (cell: HTMLTableCellElement, pseudo: string) => number | null;
}

function tripColumn(context: MembersColumnsContext, trips: NonNullable<MembersColumnsContext["trips"]>, now: Date) {
  return {
    kind: "trips",
    title: "Trajet",
    hint: trips.missing ?? "Temps d'une attaque ou d'un convoi depuis votre fourmilière. Cliquez pour trier.",
    fill: (cell, pseudo) => {
      if (pseudo.toLowerCase() === context.myPseudo.toLowerCase()) {
        const none = cell.ownerDocument.createElement("span");
        none.className = "optizzz-members-none";
        none.textContent = "vous";
        cell.append(none);
        return 0;
      }
      if (!trips.byPseudo) return null;
      const trip = trips.byPseudo.get(pseudo.toLowerCase());
      if (!trip) {
        cell.textContent = "?";
        cell.title = "Absent de l'export public (mis à jour chaque heure) : nouveau membre ?";
        return null;
      }
      const arrival = new Date(now.getTime() + trip.travelSeconds * 1000);
      cell.textContent = formatDuration(trip.travelSeconds * 1000);
      cell.title = `Distance : ${formatDecimal(trip.distance)} · arrivée en partant maintenant : ${formatEndTime(arrival, now)}`;
      return trip.travelSeconds;
    },
  } satisfies Column;
}

function roleColumn(roles: Map<string, MemberRole>) {
  // From the granaries down: the order of the first click.
  const order = rolesTopDown([...roles.values()].map((bubble) => bubble.role)).map(roleKey);
  return {
    kind: "roles",
    title: "Rôle",
    hint:
      "Rôle dans la chaîne de TDC, aux couleurs choisies dans la Chaîne ; ↓ à flooder, ↑ doit flooder, quand le " +
      "TDC dépasse un membre de l'échelon voisin. Cliquez pour trier.",
    fill: (cell, pseudo) => {
      const bubble = roles.get(pseudo.toLowerCase());
      if (!bubble) {
        cell.textContent = "?";
        cell.title = "Absent de l'export public (mis à jour chaque heure) : nouveau membre ?";
        return null;
      }
      const label = cell.ownerDocument.createElement("span");
      label.className = "optizzz-members-role";
      // The map's colour; one size in a table, where the bubble's size would only make the rows uneven.
      label.style.setProperty("--role-color", bubble.color);
      label.dataset.shape = bubble.shape;
      label.textContent = roleLabel(bubble.role);
      cell.append(label);
      // A small ↑ or ↓ beside the role, the sentence in its tooltip and for screen readers; nothing at its place.
      const { place } = bubble;
      if (place && place.kind !== "ok") {
        const badge = cell.ownerDocument.createElement("span");
        badge.className = "optizzz-rung-place";
        badge.textContent = rungPlaceArrow(place.kind);
        badge.title = rungPlaceText(place.kind, `${place.than} (${roleLabel(place.thanRole)})`);
        badge.setAttribute("role", "img");
        badge.setAttribute("aria-label", badge.title);
        cell.append(badge);
      }
      return order.indexOf(roleKey(bubble.role));
    },
  } satisfies Column;
}

/** « ▲ +100 (+10 %) »: an arrow beside the sign, the colour never alone (ADR 0003). */
function evolutionText(from: number, to: number, since: string): { text: string; title: string } {
  const delta = to - from;
  const percent = from > 0 ? (delta / from) * 100 : 0;
  const sign = delta > 0 ? "+" : delta < 0 ? "−" : "";
  // The arrow after the number (asked for on 2026-11-20): right-aligned, the numbers line up on their sign.
  const arrow = delta > 0 ? " ▲" : delta < 0 ? " ▼" : "";
  return {
    // The percentage in the tooltip: on the line, the two columns pushed the table out of the game's frame.
    // Always short, whatever « Nombres arrondis » says: « ▲ +1 168 672 » made the column twice as wide.
    text: `${sign}${formatCompact(Math.abs(delta))}${arrow}`,
    title: `${sign}${formatDecimal(Math.abs(percent))} % ${since} (${formatNumber(from)} → ${formatNumber(to)})`,
  };
}

function evolutionColumn(evolution: Map<string, MemberEvolution>, which: "today" | "week") {
  return {
    kind: which,
    // « Auj. »: the game's look writes the headers in capitals, « AUJOURD'HUI » made the column twice as wide.
    title: which === "today" ? "Auj." : "7 j",
    hint:
      which === "today"
        ? "Aujourd'hui : TDC en direct moins celui de l'export de minuit. Cliquez pour trier."
        : "TDC en direct moins celui de l'export de minuit il y a 7 jours. Cliquez pour trier.",
    fill: (cell, pseudo) => {
      const member = evolution.get(pseudo.toLowerCase());
      const from = which === "today" ? member?.midnight : member?.weekAgo;
      if (!member || from === null || from === undefined) {
        cell.textContent = "—";
        cell.title = "Pas dans l'export de ce jour-là : nouveau membre ?";
        return null;
      }
      const { text, title } = evolutionText(
        from,
        member.live,
        which === "today" ? "depuis l'export de minuit" : "depuis l'export de minuit il y a 7 jours",
      );
      cell.textContent = text;
      cell.title = title;
      return from > 0 ? (member.live - from) / from : 0;
    },
  } satisfies Column;
}

/** Orders the members' rows by the column's values, and shows the arrow on its header only. */
function sortBy(table: HTMLTableElement, header: HTMLTableCellElement, position: number, descending: boolean) {
  // The header row has spanning cells: a column is found by its place among the Optizzz ones.
  const cellOf = (row: HTMLTableRowElement) => row.querySelectorAll<HTMLElement>(`td.${COLUMN_CLASS}`)[position];
  for (const th of table.querySelectorAll("th")) th.classList.remove(ASCENDING, DESCENDING);
  header.classList.add(descending ? DESCENDING : ASCENDING);
  const rows = [...table.rows].filter((row) => cellOf(row)?.dataset.sort !== undefined);
  const value = (row: HTMLTableRowElement) => {
    const sort = cellOf(row)?.dataset.sort;
    return sort ? Number(sort) : null;
  };
  rows.sort((a, b) => {
    const [x, y] = [value(a), value(b)];
    if (x === null || y === null) return (x === null ? 1 : 0) - (y === null ? 1 : 0);
    return descending ? y - x : x - y;
  });
  for (const row of rows) row.parentElement?.append(row);
}

/**
 * Adds the switched-on columns at the end of `#tabMembresAlliance`, each sorted by a click on its header. Does
 * nothing when they are already there.
 */
export function addMembersColumns(doc: Document, context: MembersColumnsContext, now: Date) {
  const table = doc.querySelector<HTMLTableElement>("#tabMembresAlliance");
  if (!table) return;
  shortenGameHeaders(table);
  if (table.querySelector(`.${COLUMN_CLASS}`)) return;
  const columns: Column[] = [
    ...(context.trips ? [tripColumn(context, context.trips, now)] : []),
    ...(context.roles ? [roleColumn(context.roles)] : []),
    ...(context.evolution
      ? [evolutionColumn(context.evolution, "today"), evolutionColumn(context.evolution, "week")]
      : []),
  ];
  for (const [position, column] of columns.entries()) {
    for (const row of table.rows) {
      const header = row.querySelector(":scope > th") !== null;
      const cell = doc.createElement(header ? "th" : "td");
      cell.className = `${COLUMN_CLASS} optizzz-members-${column.kind}`;
      row.append(cell);
      if (header) {
        const trigger = doc.createElement("a");
        trigger.href = "#";
        trigger.textContent = column.title;
        cell.title = column.hint;
        cell.append(trigger);
        trigger.addEventListener("click", (event) => {
          event.preventDefault();
          sortBy(table, cell, position, cell.classList.contains(ASCENDING));
        });
        continue;
      }
      const pseudo = row.cells[PSEUDO_CELL]?.querySelector("a")?.textContent.trim();
      if (pseudo?.toLowerCase() === context.myPseudo.toLowerCase()) row.classList.add(ME_CLASS);
      if (pseudo) cell.dataset.sort = String(column.fill(cell, pseudo) ?? "");
    }
  }
  // A sort by the game's columns: its arrow only.
  table.addEventListener(
    "click",
    (event) => {
      if (!(event.target instanceof Element) || !event.target.closest(".fdTableSortTrigger")) return;
      for (const th of table.querySelectorAll(`th.${COLUMN_CLASS}`)) th.classList.remove(ASCENDING, DESCENDING);
    },
    { capture: true },
  );
}

/** Marks the cells of a hidden column, the game's or Optizzz's. */
export const HIDDEN_CLASS = "optizzz-hidden-column";

/** A column that can be hidden: the game's, by its header, or one Optizzz adds. */
export type HideableColumn = "grade" | "technology" | "building" | "state" | Column["kind"];

/** `headers`: the game's, then the short one Optizzz writes in its place. */
const GAME_COLUMNS: { id: HideableColumn; headers: string[]; label: string; short?: string }[] = [
  { id: "grade", headers: ["rang"], label: "Rang" },
  { id: "technology", headers: ["technologie", "tech."], label: "Technologie", short: "Tech." },
  { id: "building", headers: ["fourmiliere", "fourm."], label: "Fourmilière", short: "Fourm." },
  { id: "state", headers: ["etat"], label: "État" },
];

/**
 * « Tech. » and « Fourm. » for the game's « Technologie » and « Fourmiliere », the full word in the tooltip: the game's
 * look writes the headers in capitals, and these two made their 3-digit columns 115px wide.
 */
function shortenGameHeaders(table: HTMLTableElement) {
  const headerRow = [...table.rows].find((row) => row.querySelector(":scope > th"));
  for (const header of headerRow?.cells ?? []) {
    const column = GAME_COLUMNS.find((game) => game.short && game.headers[0] === plainText(header.textContent));
    if (!column?.short) continue;
    // The text itself, inside the game's sort link when it added one.
    const walker = header.ownerDocument.createTreeWalker(header, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.textContent?.trim()) continue;
      node.textContent = column.short;
      break;
    }
    header.title = column.label;
  }
}

const OPTIZZZ_COLUMNS: { id: Column["kind"]; label: string }[] = [
  { id: "trips", label: "Trajet" },
  { id: "roles", label: "Rôle" },
  { id: "today", label: "Aujourd'hui" },
  { id: "week", label: "7 j" },
];

const plainText = (text: string) =>
  text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

/** The game's header cells by column, with the body cells under each: its header merges some of them (colspan). */
function gameColumns(table: HTMLTableElement): Map<HideableColumn, { header: HTMLTableCellElement; cells: number[] }> {
  const columns = new Map<HideableColumn, { header: HTMLTableCellElement; cells: number[] }>();
  const headerRow = [...table.rows].find((row) => row.querySelector(":scope > th"));
  let start = 0;
  for (const header of headerRow?.cells ?? []) {
    if (header.classList.contains(COLUMN_CLASS)) continue;
    const span = Math.max(1, header.colSpan);
    const column = GAME_COLUMNS.find((game) => game.headers.includes(plainText(header.textContent)));
    if (column) columns.set(column.id, { header, cells: Array.from({ length: span }, (_, i) => start + i) });
    start += span;
  }
  return columns;
}

/** Hides the columns in `hidden` and shows the others, again after each change of the table. */
export function hideMembersColumns(doc: Document, hidden: ReadonlySet<string>) {
  const table = doc.querySelector<HTMLTableElement>("#tabMembresAlliance");
  if (!table) return;
  for (const [id, { header, cells }] of gameColumns(table)) {
    const hide = hidden.has(id);
    header.classList.toggle(HIDDEN_CLASS, hide);
    for (const row of table.rows) {
      if (row.querySelector(":scope > th")) continue;
      for (const index of cells) row.cells[index]?.classList.toggle(HIDDEN_CLASS, hide);
    }
  }
  for (const { id } of OPTIZZZ_COLUMNS)
    for (const cell of table.querySelectorAll(`.optizzz-members-${id}`))
      cell.classList.toggle(HIDDEN_CLASS, hidden.has(id));
}

/**
 * « Colonnes », above the members table: a box per column that can be hidden (the game's Rang, Technologie,
 * Fourmilière and État, and those Optizzz added), ticked when shown. `onChange` gets the new hidden set.
 */
export function addColumnPicker(doc: Document, hidden: ReadonlySet<string>, onChange: (hidden: Set<string>) => void) {
  const table = doc.querySelector<HTMLTableElement>("#tabMembresAlliance");
  if (!table) return;
  const current = new Set(hidden);
  const game = gameColumns(table);
  const choices = [
    ...GAME_COLUMNS.filter((column) => game.has(column.id)),
    ...OPTIZZZ_COLUMNS.filter((column) => table.querySelector(`th.optizzz-members-${column.id}`)),
  ];
  const ids = choices.map((choice) => choice.id).join(" ");
  // Built again when columns came since (« Aujourd'hui » and « 7 j » wait for the nightly exports).
  // Wherever it is: another script may put its block between it and the table, and moving it back made that script
  // redraw its block, then this one move again… the page flickered.
  const existing = table.parentElement?.querySelector<HTMLDetailsElement>(":scope > .optizzz-columns-picker");
  if (existing?.dataset.columns === ids) return;
  const wasOpen = doc.querySelector<HTMLDetailsElement>(".optizzz-columns-picker")?.open ?? false;
  for (const old of doc.querySelectorAll(".optizzz-columns-picker")) old.remove();
  const picker = doc.createElement("details");
  picker.className = "optizzz-columns-picker";
  picker.dataset.columns = ids;
  picker.open = wasOpen;
  const summary = doc.createElement("summary");
  summary.textContent = "Colonnes";
  picker.append(summary);
  for (const { id, label } of choices) {
    const box = doc.createElement("input");
    box.type = "checkbox";
    box.checked = !current.has(id);
    box.addEventListener("change", () => {
      if (box.checked) current.delete(id);
      else current.add(id);
      onChange(new Set(current));
    });
    const wrapper = doc.createElement("label");
    wrapper.append(box, ` ${label}`);
    picker.append(wrapper);
  }
  table.before(picker);
}

/** Takes the columns away, to add them again with new data. */
export function removeMembersColumns(doc: Document) {
  for (const cell of doc.querySelectorAll(`#tabMembresAlliance .${COLUMN_CLASS}`)) cell.remove();
  for (const row of doc.querySelectorAll(`#tabMembresAlliance .${ME_CLASS}`)) row.classList.remove(ME_CLASS);
}
