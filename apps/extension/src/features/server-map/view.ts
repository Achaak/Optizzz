// What the server map draws and lists from the chosen players. See docs/features/carte-serveur.md.
import type { Player } from "@optizzz/game/exports";
import { distance, travelTime } from "@optizzz/game/travel";
import type { Level, Trip } from "@/features/alliance-map/neighbor-table";
import { fittedWindow, type AxisRange, type MapWindow } from "@/utils/map-chart/axes";
import type { Chip } from "./selection";

/** Above this many chosen players in view, alliances show their tag instead of each member's pseudo. */
export const PSEUDOS_IN_VIEW = 40;

/** Whether few enough chosen players are in view for their pseudos to be readable. */
export function showPseudos(
  view: { x: AxisRange; y: AxisRange },
  positions: readonly { x: number; y: number }[],
  limit = PSEUDOS_IN_VIEW,
): boolean {
  let inView = 0;
  for (const { x, y } of positions) {
    if (x >= view.x[0] && x <= view.x[1] && y >= view.y[0] && y <= view.y[1] && ++inView > limit) return false;
  }
  return true;
}

/** A part of the map to show, asked at `at` (ms): the whole server, or a window. */
export type ZoomRequest = ({ full: true } | { full: false; x: AxisRange; y: AxisRange }) & { at: number };

/** Squares shown around a player zoomed on. */
const ZOOM_RADIUS = 8;

/** The window around me and the chosen players, with the shape of the server; all of it when there is none. */
export function frameRequest(points: readonly { x: number; y: number }[], full: MapWindow, at: number): ZoomRequest {
  if (points.length === 0) return { full: true, at };
  const { x, y } = fittedWindow(points, full);
  return { full: false, x, y, at };
}

/** A few squares around one player. */
export function zoomAround(player: { x: number; y: number }, full: MapWindow, at: number): ZoomRequest {
  return frameRequest(
    [
      { x: player.x - ZOOM_RADIUS, y: player.y - ZOOM_RADIUS },
      { x: player.x + ZOOM_RADIUS, y: player.y + ZOOM_RADIUS },
    ],
    full,
    at,
  );
}

export interface AllianceCenter {
  tag: string;
  color: string;
  x: number;
  y: number;
}

/** Where each chosen alliance's tag is written: the mean position of its members drawn. */
export function allianceCenters(highlighted: ReadonlyMap<Player, Chip>): AllianceCenter[] {
  const sums = new Map<Chip, { x: number; y: number; count: number }>();
  for (const [player, chip] of highlighted) {
    if (chip.kind !== "alliance") continue;
    const sum = sums.get(chip) ?? { x: 0, y: 0, count: 0 };
    sums.set(chip, { x: sum.x + player.x, y: sum.y + player.y, count: sum.count + 1 });
  }
  return [...sums].flatMap(([chip, { x, y, count }]) =>
    chip.kind === "alliance" ? [{ tag: chip.tag, color: chip.color, x: x / count, y: y / count }] : [],
  );
}

export interface TableRow {
  player: Player;
  chip: Chip;
  distance: number;
  /** From the reference player to this one. */
  trip: Trip;
}

/** The chosen players but the reference, nearest first. `level`: the reference's Attack Speed. */
export function tableRows(
  reference: { id: number; x: number; y: number },
  highlighted: ReadonlyMap<Player, Chip>,
  level: Level,
): TableRow[] {
  const rows: TableRow[] = [];
  for (const [player, chip] of highlighted) {
    if (player.id === reference.id) continue;
    const d = distance(reference, player);
    rows.push({ player, chip, distance: d, trip: { ...level, seconds: travelTime(d, level.level) } });
  }
  return rows.sort((a, b) => a.distance - b.distance);
}

export type SortKey = "pseudo" | "alliance" | "distance" | "field";

const compare: Record<SortKey, (a: TableRow, b: TableRow) => number> = {
  pseudo: (a, b) => a.player.pseudo.localeCompare(b.player.pseudo, "fr"),
  alliance: (a, b) => (a.player.alliance ?? "").localeCompare(b.player.alliance ?? "", "fr"),
  // The trip grows with the distance: one column order for both.
  distance: (a, b) => a.distance - b.distance,
  field: (a, b) => a.player.field - b.player.field,
};

export function sortRows(rows: readonly TableRow[], key: SortKey, descending: boolean): TableRow[] {
  const sign = descending ? -1 : 1;
  return [...rows].sort((a, b) => sign * compare[key](a, b));
}
