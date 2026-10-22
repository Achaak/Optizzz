// Pseudos next to the points of a map, shared by the alliance map and the server map: each name takes the first free
// spot around its point, so names never overlap each other nor cover another point. ECharts' own `moveOverlap` only
// shifts along one axis (made for pie labels in a column): with names spread over a map, it squeezes them back
// together. A layout free at some zoom stays free when zooming in: points spread apart, names keep their size.

export interface LabelItem {
  id: number;
  /** Centre of the point, in pixels. */
  x: number;
  y: number;
  /** Size of the name, in pixels. */
  width: number;
  height: number;
  /** Half the point's size; 5 by default. */
  radius?: number;
}

/** Where ECharts writes the label: a side of the point, moved by `offset` pixels. */
export interface LabelSpot {
  position: "right" | "left" | "top" | "bottom";
  offset: readonly [number, number];
}

interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** ECharts' gap between a point and its label (`label.distance`). */
const DISTANCE = 5;

/** Candidate spots, most natural first: right of the point as the game's maps write names. */
function candidates(height: number): LabelSpot[] {
  return [
    { position: "right", offset: [0, 0] },
    { position: "left", offset: [0, 0] },
    { position: "top", offset: [0, 0] },
    { position: "bottom", offset: [0, 0] },
    { position: "right", offset: [0, -height] },
    { position: "right", offset: [0, height] },
    { position: "left", offset: [0, -height] },
    { position: "left", offset: [0, height] },
  ];
}

/** The box ECharts draws the label in, for this spot. */
export function labelRect(item: LabelItem, spot: LabelSpot): Rect {
  const r = item.radius ?? 5;
  const [dx, dy] = spot.offset;
  const { width: w, height: h } = item;
  const [left, top] =
    spot.position === "right"
      ? [item.x + r + DISTANCE, item.y - h / 2]
      : spot.position === "left"
        ? [item.x - r - DISTANCE - w, item.y - h / 2]
        : spot.position === "top"
          ? [item.x - w / 2, item.y - r - DISTANCE - h]
          : [item.x - w / 2, item.y + r + DISTANCE];
  return { left: left + dx, top: top + dy, right: left + dx + w, bottom: top + dy + h };
}

const overlap = (a: Rect, b: Rect) =>
  Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
  Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));

/** Rectangles bucketed by area: a name is only tested against what is near it. */
class RectIndex {
  private readonly cells = new Map<string, Rect[]>();
  constructor(private readonly size = 64) {}

  private keys(rect: Rect): string[] {
    const keys: string[] = [];
    for (let i = Math.floor(rect.left / this.size); i <= Math.floor(rect.right / this.size); i++)
      for (let j = Math.floor(rect.top / this.size); j <= Math.floor(rect.bottom / this.size); j++)
        keys.push(`${String(i)}:${String(j)}`);
    return keys;
  }

  add(rect: Rect): void {
    for (const key of this.keys(rect)) {
      const cell = this.cells.get(key);
      if (cell) cell.push(rect);
      else this.cells.set(key, [rect]);
    }
  }

  /** Area of `rect` covered by the indexed rectangles (a rectangle in several cells counts once). */
  covered(rect: Rect, except?: Rect): number {
    const seen = new Set<Rect>();
    let total = 0;
    for (const key of this.keys(rect))
      for (const other of this.cells.get(key) ?? []) {
        if (other === except || seen.has(other)) continue;
        seen.add(other);
        total += overlap(rect, other);
      }
    return total;
  }
}

/**
 * A spot for each name, in the order given (the first ones get the best spots), or null when none is free: the name is
 * then hidden, unless `everyName` asks for all of them, written where it overlaps least. `area` is the plot: a spot
 * outside it counts as taken.
 */
export function placeLabels(
  items: readonly LabelItem[],
  { area, everyName }: { area: Rect; everyName: boolean },
): Map<number, LabelSpot | null> {
  const points = new RectIndex();
  const pointRects = new Map<LabelItem, Rect>();
  for (const item of items) {
    const r = item.radius ?? 5;
    const rect = { left: item.x - r, top: item.y - r, right: item.x + r, bottom: item.y + r };
    pointRects.set(item, rect);
    points.add(rect);
  }
  const names = new RectIndex();
  const spots = new Map<number, LabelSpot | null>();
  for (const item of items) {
    let best: { spot: LabelSpot; rect: Rect; cost: number } | null = null;
    for (const spot of candidates(item.height)) {
      const rect = labelRect(item, spot);
      const outside = item.width * item.height - overlap(rect, area);
      const cost = names.covered(rect) + points.covered(rect, pointRects.get(item)) + outside;
      if (!best || cost < best.cost) best = { spot, rect, cost };
      if (cost === 0) break;
    }
    if (best && (best.cost === 0 || everyName)) {
      spots.set(item.id, best.spot);
      names.add(best.rect);
    } else spots.set(item.id, null);
  }
  return spots;
}

/** Text width in pixels, for the names ECharts writes (12 px, sans-serif); an estimate where no canvas exists. */
export function measureName(text: string, bold = false): number {
  const context = typeof document === "undefined" ? null : measureContext();
  if (!context) return text.length * 7;
  context.font = `${bold ? "bold " : ""}12px sans-serif`;
  return context.measureText(text).width;
}

let context: CanvasRenderingContext2D | null | undefined;
function measureContext(): CanvasRenderingContext2D | null {
  context ??= document.createElement("canvas").getContext("2d");
  return context;
}

/** Height of a 12 px name, as ECharts lays it out. */
export const NAME_HEIGHT = 14;

/** The plot area in pixels, and where a map point falls in it when `view` is shown. */
export function plotProjection(
  view: { x: readonly [number, number]; y: readonly [number, number] },
  grid: { left: number; right: number; top: number; bottom: number },
  size: { width: number; height: number },
) {
  const area = { left: grid.left, top: grid.top, right: size.width - grid.right, bottom: size.height - grid.bottom };
  const toPixel = (point: { x: number; y: number }) => ({
    x: area.left + ((point.x - view.x[0]) / (view.x[1] - view.x[0])) * (area.right - area.left),
    y: area.bottom - ((point.y - view.y[0]) / (view.y[1] - view.y[0])) * (area.bottom - area.top),
  });
  return { area, toPixel };
}

/** ECharts label options for a spot: hidden without one. */
export const spotLabel = (spot: LabelSpot | null | undefined) =>
  spot ? { show: true, position: spot.position, offset: [...spot.offset] } : { show: false };
