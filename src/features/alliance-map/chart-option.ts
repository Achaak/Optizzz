import type { EChartsCoreOption } from "echarts/core";
import type { Player } from "@/data/exports";
import { levelOf, type KnownLevels } from "./neighbor-table";
import { kNearestLinks, membersByDistance } from "./neighbors";
import { distance, travelTime } from "@/game/travel";
import { CHART_COLORS } from "@/theme";
import { formatDecimal, formatNumber } from "@/utils/number-format";
import { formatDuration } from "@/utils/time-format";

export interface MapMember extends Player {
  /** Hunting field read live on the members page, otherwise the export's. */
  huntingField: number;
}

const COLORS = { ...CHART_COLORS, selectedLink: CHART_COLORS.selected };

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Squares kept free around the outermost players. */
const MARGIN = 2;
/** Tick steps, the smallest one giving at most 10 ticks is used. */
const NICE_STEPS = [5, 10, 20, 25, 50, 100, 200, 250, 500];

/**
 * Same range on both axes, so distances are not distorted, starting and ending on a tick. Map coordinates are
 * never negative: an axis only goes below 0 by one step, to keep a player at 0 off the axis line.
 */
export function bounds(members: readonly Pick<MapMember, "x" | "y">[]) {
  const xs = members.map((m) => m.x);
  const ys = members.map((m) => m.y);
  const extent = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 4) + 2 * MARGIN;
  const step = NICE_STEPS.find((candidate) => extent / candidate <= 10) ?? 1000;
  const fit = (values: number[]) => {
    const min = Math.min(...values);
    const start = Math.floor((min - MARGIN) / step) * step;
    return { start, needed: Math.ceil((Math.max(...values) + MARGIN - start) / step) * step, min };
  };
  const fits = { x: fit(xs), y: fit(ys) };
  const size = Math.max(fits.x.needed, fits.y.needed);
  const axis = ({ start, needed, min }: ReturnType<typeof fit>) => {
    const centered = start - Math.floor((size - needed) / 2 / step) * step;
    const from = Math.max(min >= MARGIN ? 0 : -step, centered);
    return [from, from + size] as const;
  };
  return { x: axis(fits.x), y: axis(fits.y), step };
}

const GRID = { left: 40, top: 16, bottom: 32, labels: 90 };

/** Chart height for a width, so that the plot area is square (same scale on both axes). */
export const chartHeightFor = (width: number, maxHeight: number) =>
  Math.min(maxHeight, Math.max(160, width - GRID.left - GRID.labels) + GRID.top + GRID.bottom);

/** Grid leaving a square plot area, centered; labels sit to the right of the points. */
export function squareGrid(width: number, height: number) {
  const plot = Math.max(100, Math.min(width - GRID.left - GRID.labels, height - GRID.top - GRID.bottom));
  const extra = Math.max(0, width - GRID.left - GRID.labels - plot) / 2;
  return { left: GRID.left + extra, right: GRID.labels + extra, top: GRID.top, bottom: height - GRID.top - plot };
}

/** Whole, non-negative coordinates only: no « 69.5 » after a zoom, no « −5 ». */
const coordinateLabel = (value: number) => (Number.isInteger(value) && value >= 0 ? String(value) : "");

export function buildChartOption(
  members: readonly MapMember[],
  selected: MapMember,
  k: number,
  levels: KnownLevels,
  size: { width: number; height: number },
): EChartsCoreOption {
  const selectedNeighbors = new Set(
    membersByDistance(selected, members)
      .slice(0, k)
      .map((n) => n.player.id),
  );
  const indexById = new Map(members.map((m, i) => [m.id, i]));
  const { x, y, step } = bounds(members);

  const nodes = members.map((m) => {
    const isSelected = m.id === selected.id;
    const color = isSelected
      ? COLORS.selected
      : selectedNeighbors.has(m.id)
        ? COLORS.neighbor
        : m.onHoliday
          ? COLORS.holiday
          : COLORS.member;
    return {
      name: m.pseudo,
      value: [m.x, m.y],
      symbolSize: isSelected ? 16 : 11,
      itemStyle: { color, opacity: m.onHoliday ? 0.55 : 1 },
      label: {
        formatter: `${m.masterPlayerId !== null ? "⛓ " : ""}${m.pseudo}`,
        fontWeight: isSelected ? "bold" : "normal",
        color: m.onHoliday ? COLORS.holiday : COLORS.text,
      },
    };
  });

  const links = [...kNearestLinks(members, k)].map((key) => {
    const [a, b] = key.split("-").map(Number) as [number, number];
    const other = a === selected.id ? b : b === selected.id ? a : null;
    const fromSelected = other !== null && selectedNeighbors.has(other);
    return {
      source: indexById.get(a),
      target: indexById.get(b),
      lineStyle: fromSelected
        ? { color: COLORS.selectedLink, width: 2.5, opacity: 1 }
        : { color: COLORS.link, width: 1 },
    };
  });

  const selectedLevel = levelOf(selected.id, levels);
  const dashedGrid = { lineStyle: { type: "dashed", opacity: 0.4 } };
  const axis = (range: readonly [number, number]) => ({
    type: "value",
    min: range[0],
    max: range[1],
    interval: step,
    minInterval: 1,
    splitLine: dashedGrid,
    // At the edge of the plot, not through 0: a player at 0 stays off the line.
    axisLine: { onZero: false },
    axisLabel: { formatter: coordinateLabel },
  });
  // The wheel alone scrolls the page; Ctrl (or a trackpad pinch) + wheel zooms.
  const zoom = { type: "inside", filterMode: "none", zoomOnMouseWheel: "ctrl", moveOnMouseWheel: false };

  return {
    animation: false,
    grid: squareGrid(size.width, size.height),
    xAxis: axis(x),
    yAxis: axis(y),
    dataZoom: [
      { ...zoom, xAxisIndex: 0 },
      { ...zoom, yAxisIndex: 0 },
    ],
    tooltip: {
      confine: true,
      formatter: (params: { dataType?: string; dataIndex: number }) => {
        const m = params.dataType === "node" ? members[params.dataIndex] : undefined;
        if (!m) return "";
        const lines = [
          `<b>${escapeHtml(m.pseudo)}</b> (${m.x} ; ${m.y})`,
          m.grade ? `Grade : ${escapeHtml(m.grade)}` : null,
          `TDC : ${formatNumber(m.huntingField)} cm²`,
          m.onHoliday ? "En vacances" : null,
          m.masterPlayerId !== null ? "Colonisé" : null,
        ];
        if (m.id !== selected.id) {
          const d = distance(selected, m);
          lines.push(
            `Distance depuis ${escapeHtml(selected.pseudo)} : ${formatDecimal(d)}`,
            `Trajet ${escapeHtml(selected.pseudo)} → ${escapeHtml(m.pseudo)} : ${selectedLevel.estimated ? "≈ " : ""}${formatDuration(travelTime(d, selectedLevel.level) * 1000)}`,
          );
        }
        return lines.filter(Boolean).join("<br>");
      },
    },
    series: [
      {
        type: "graph",
        coordinateSystem: "cartesian2d",
        layout: "none",
        data: nodes,
        links,
        label: { show: true, position: "right", fontSize: 12 },
        emphasis: { scale: false, label: { show: true } },
      },
    ],
  };
}

/** Zoom window around a player and its k nearest neighbors. */
export function zoomWindowAround(selected: MapMember, members: readonly MapMember[], k: number) {
  const group = [
    selected,
    ...membersByDistance(selected, members)
      .slice(0, k)
      .map((n) => n.player),
  ];
  return bounds(group);
}
