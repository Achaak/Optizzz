import { rolesTopDown, type MemberBubble } from "@/features/tdc-chain/role-styles";
import { roleKey, roleLabel } from "@/features/tdc-chain/roles";
import { formatDecimal } from "@/utils/number-format";
import { formatDuration, formatEndTime } from "@/utils/time-format";
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
.optizzz-members-role[data-shape="triangle"]::before { border-radius: 0; clip-path: polygon(50% 0, 100% 100%, 0 100%); }`;

export interface MembersColumnsContext {
  myPseudo: string;
  /** The « Trajet » column; absent when switched off. `byPseudo` is null when the trips cannot be known. */
  trips?: { byPseudo: Map<string, MemberTrip> | null; missing?: string };
  /** The « Rôle » column: each member's chain role and its bubble, by lowercase nickname; absent when switched off. */
  roles?: Map<string, MemberBubble>;
}

interface Column {
  /** Class of its cells: `optizzz-members-<kind>`. */
  kind: "trips" | "roles";
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

function roleColumn(roles: Map<string, MemberBubble>) {
  // From the granaries down: the order of the first click.
  const order = rolesTopDown([...roles.values()].map((bubble) => bubble.role)).map(roleKey);
  return {
    kind: "roles",
    title: "Rôle",
    hint: "Rôle dans la chaîne de TDC, aux couleurs choisies dans la Chaîne. Cliquez pour trier.",
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
      return order.indexOf(roleKey(bubble.role));
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
  if (!table || table.querySelector(`.${COLUMN_CLASS}`)) return;
  const columns: Column[] = [
    ...(context.trips ? [tripColumn(context, context.trips, now)] : []),
    ...(context.roles ? [roleColumn(context.roles)] : []),
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

/** Takes the columns away, to add them again with new data. */
export function removeMembersColumns(doc: Document) {
  for (const cell of doc.querySelectorAll(`#tabMembresAlliance .${COLUMN_CLASS}`)) cell.remove();
  for (const row of doc.querySelectorAll(`#tabMembresAlliance .${ME_CLASS}`)) row.classList.remove(ME_CLASS);
}
