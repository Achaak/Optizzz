// The game map drawn by ECharts, shared by the alliance map and the server map: both axes on the same scale, round
// ticks, and the zoom controls. The alliance map keeps a square plot area; the server map takes the server's shape.

/** Squares kept free around the outermost players. */
const MARGIN = 2;
/** Tick steps, the smallest one giving at most 10 ticks is used. */
const NICE_STEPS = [5, 10, 20, 25, 50, 100, 200, 250, 500];

export type AxisRange = readonly [number, number];

export interface MapAxes {
  x: AxisRange;
  y: AxisRange;
  step: number;
}

/** A part of the map: a range on each axis. */
export type MapWindow = Pick<MapAxes, "x" | "y">;

/** The tick step for these points, and where each axis starts and how long it must be to hold them. */
function fitTicks(points: readonly { x: number; y: number }[]) {
  const xs = points.map((m) => m.x);
  const ys = points.map((m) => m.y);
  const extent = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 4) + 2 * MARGIN;
  const step = NICE_STEPS.find((candidate) => extent / candidate <= 10) ?? 1000;
  const fit = (values: number[]) => {
    const min = Math.min(...values);
    const start = Math.floor((min - MARGIN) / step) * step;
    return { start, needed: Math.ceil((Math.max(...values) + MARGIN - start) / step) * step, min };
  };
  return { fits: { x: fit(xs), y: fit(ys) }, step };
}

/**
 * Same range on both axes, so distances are not distorted, starting and ending on a tick. Map coordinates are
 * never negative: an axis only goes below 0 by one step, to keep a player at 0 off the axis line.
 */
export function bounds(points: readonly { x: number; y: number }[]): MapAxes {
  const { fits, step } = fitTicks(points);
  const size = Math.max(fits.x.needed, fits.y.needed);
  const axis = ({ start, needed, min }: (typeof fits)["x"]) => {
    const centered = start - Math.floor((size - needed) / 2 / step) * step;
    const from = Math.max(min >= MARGIN ? 0 : -step, centered);
    return [from, from + size] as const;
  };
  return { x: axis(fits.x), y: axis(fits.y), step };
}

const GRID = { left: 40, top: 16, bottom: 32, labels: 90 };
/** The fitted plot keeps its names inside (`placeLabels`): no room kept for them on the right. */
const FITTED_RIGHT = 16;

/** Chart height for a width, so that the plot area is square (same scale on both axes). */
export const chartHeightFor = (width: number, maxHeight: number) =>
  Math.min(maxHeight, Math.max(160, width - GRID.left - GRID.labels) + GRID.top + GRID.bottom);

/** Grid leaving a square plot area, centered; labels sit to the right of the points. */
export function squareGrid(width: number, height: number) {
  const plot = Math.max(100, Math.min(width - GRID.left - GRID.labels, height - GRID.top - GRID.bottom));
  const extra = Math.max(0, width - GRID.left - GRID.labels - plot) / 2;
  return { left: GRID.left + extra, right: GRID.labels + extra, top: GRID.top, bottom: height - GRID.top - plot };
}

/**
 * Each axis just long enough for the points and a margin: the plot then takes the shape of the map. Its ticks are left
 * to ECharts (`mapAxis` without a step), round in any zoom window.
 */
export function fittedBounds(points: readonly { x: number; y: number }[]): MapWindow {
  const axis = (values: number[]) => [Math.min(...values) - MARGIN, Math.max(...values) + MARGIN] as const;
  return { x: axis(points.map((p) => p.x)), y: axis(points.map((p) => p.y)) };
}

/** Height of the plot over its width, for one scale on both axes. */
const aspectOf = (axes: MapWindow) => (axes.y[1] - axes.y[0]) / (axes.x[1] - axes.x[0]);

/** Chart height for a width, so that the plot area has the shape of `axes`. */
export function fittedHeight(width: number, maxHeight: number, axes: MapWindow): number {
  const plot = Math.max(100, width - GRID.left - FITTED_RIGHT) * aspectOf(axes);
  return Math.min(maxHeight, Math.max(160, plot + GRID.top + GRID.bottom));
}

/** Grid leaving a plot area with the shape of `axes`, centered; labels sit to the right of the points. */
export function fittedGrid(width: number, height: number, axes: MapWindow) {
  const aspect = aspectOf(axes);
  const room = { width: Math.max(100, width - GRID.left - FITTED_RIGHT), height: height - GRID.top - GRID.bottom };
  const plotHeight = Math.min(room.height, room.width * aspect);
  const extra = Math.max(0, room.width - plotHeight / aspect) / 2;
  return {
    left: GRID.left + extra,
    right: FITTED_RIGHT + extra,
    top: GRID.top,
    bottom: height - GRID.top - plotHeight,
  };
}

/** Narrowest window shown, in squares. */
const MIN_WINDOW = 10;

/**
 * The window around `points` with the shape of `full` (the plot's), so a zoom keeps one scale; slid back inside `full`
 * near an edge, and `full` itself when it would be as large.
 */
export function fittedWindow(points: readonly { x: number; y: number }[], full: MapWindow): MapWindow {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const aspect = aspectOf(full);
  const span = {
    x: Math.max(...xs) - Math.min(...xs) + 2 * MARGIN,
    y: Math.max(...ys) - Math.min(...ys) + 2 * MARGIN,
  };
  const width = Math.max(span.x, span.y / aspect, MIN_WINDOW);
  if (width >= full.x[1] - full.x[0]) return { x: full.x, y: full.y };
  const place = (center: number, size: number, range: AxisRange) => {
    const from = Math.min(Math.max(center - size / 2, range[0]), range[1] - size);
    return [from, from + size] as const;
  };
  return {
    x: place((Math.max(...xs) + Math.min(...xs)) / 2, width, full.x),
    y: place((Math.max(...ys) + Math.min(...ys)) / 2, width * aspect, full.y),
  };
}

/** Whole, non-negative coordinates only: no « 69.5 » after a zoom, no « −5 ». */
const coordinateLabel = (value: number) => (Number.isInteger(value) && value >= 0 ? String(value) : "");

/**
 * A map axis: dashed grid, round ticks, coordinates as the game writes them. Without `step`, ECharts picks round ticks
 * itself, also in a zoom window that does not start on one (a fixed interval counts from the window's edge).
 */
export function mapAxis(range: AxisRange, step?: number, splitNumber = 8) {
  return {
    type: "value",
    min: range[0],
    max: range[1],
    ...(step === undefined ? { splitNumber } : { interval: step }),
    // The window's edges are rarely round: only the ticks are written.
    minInterval: 1,
    splitLine: { lineStyle: { type: "dashed", opacity: 0.4 } },
    // At the edge of the plot, not through 0: a player at 0 stays off the line.
    axisLine: { onZero: false },
    axisLabel: { formatter: coordinateLabel, ...(step === undefined && { showMinLabel: false, showMaxLabel: false }) },
  };
}

// The wheel alone scrolls the page; Ctrl (or a trackpad pinch) + wheel zooms.
const ZOOM = { type: "inside", filterMode: "none", zoomOnMouseWheel: "ctrl", moveOnMouseWheel: false };

/** Zoom on both axes: index 0 is x, 1 is y. */
export const MAP_ZOOM = [
  { ...ZOOM, xAxisIndex: 0 },
  { ...ZOOM, yAxisIndex: 0 },
];

/** About one tick every 70 pixels: a narrow map (a phone) gets fewer, readable ones. */
export const ticksFor = (pixels: number) => Math.max(3, Math.min(8, Math.round(pixels / 70)));
