import type { EChartsCoreOption } from "echarts/core";
import type { Player } from "@optizzz/game/exports";
import { levelOf, type KnownLevels } from "./neighbor-table";
import { kNearestLinks, membersByDistance } from "./neighbors";
import { distance, travelTime, type Level } from "@optizzz/game/travel";
import { SHAPE_SYMBOLS, type MemberBubble } from "@/features/tdc-chain/role-styles";
import { roleLabel } from "@optizzz/game/tdc-chain/roles";
import { CHART_COLORS } from "@/theme";
import { formatAmount, formatDecimal } from "@optizzz/game/format/number-format";
import { formatDuration } from "@optizzz/game/format/time-format";
import { escapeHtml } from "@optizzz/game/format/escape-html";
import { bounds, MAP_ZOOM, mapAxis, squareGrid } from "@optizzz/map/axes";
import { measureName, NAME_HEIGHT, placeLabels, plotProjection, spotLabel } from "@optizzz/map/labels";

export interface MapMember extends Player {
  /** Hunting field read live on the members page, otherwise the export's. */
  huntingField: number;
}

const COLORS = { ...CHART_COLORS, selectedLink: CHART_COLORS.selected };

const nameOf = (m: MapMember) => `${m.masterPlayerId !== null ? "⛓ " : ""}${m.pseudo}`;

/** What is written next to each member: pseudo and chain role, pseudo, or nothing (the tooltip still names them). */
export type LabelMode = "pseudoRole" | "pseudo" | "none";

export interface MapDisplay {
  /** Bubble area proportional to the member's hunting field, instead of the role's size. */
  sizeByTdc: boolean;
  labels: LabelMode;
}

const DEFAULT_DISPLAY: MapDisplay = { sizeByTdc: false, labels: "pseudo" };

const TDC_PX = { min: 6, max: 26 };

/** Bubble diameter whose area is proportional to the hunting field, the alliance's largest at the largest size. */
export function tdcBubblePx(huntingField: number, largest: number): number {
  if (largest <= 0) return TDC_PX.min;
  return Math.max(TDC_PX.min, Math.round(TDC_PX.max * Math.sqrt(Math.max(0, huntingField) / largest)));
}

export function buildChartOption(
  members: readonly MapMember[],
  selected: MapMember,
  k: number,
  levels: KnownLevels,
  size: { width: number; height: number },
  /** Chain roles shown: each member's bubble; the selected player is then ringed instead of coloured. */
  bubbles: ReadonlyMap<number, MemberBubble> | null = null,
  display: MapDisplay = DEFAULT_DISPLAY,
): EChartsCoreOption {
  const selectedNeighbors = new Set(
    membersByDistance(selected, members)
      .slice(0, k)
      .map((n) => n.player.id),
  );
  const indexById = new Map(members.map((m, i) => [m.id, i]));
  const { x, y, step } = bounds(members);
  const grid = squareGrid(size.width, size.height);
  const largestField = Math.max(0, ...members.map((m) => m.huntingField));
  const symbolSize = (m: MapMember) => {
    // The size says the hunting field: the selected player is only ringed.
    if (display.sizeByTdc) return tdcBubblePx(m.huntingField, largestField);
    const bubble = bubbles?.get(m.id);
    if (bubble) return bubble.px + (m.id === selected.id ? 4 : 0);
    return m.id === selected.id ? 16 : 11;
  };

  // Every label is written, the selected player's first: placed at the full view, they stay apart when zooming in.
  const { area, toPixel } = plotProjection({ x, y }, grid, size);
  const ordered = [selected, ...members.filter((m) => m.id !== selected.id)];
  const itemsFor = (textOf: (m: MapMember) => string) =>
    ordered.map((m) => ({
      id: m.id,
      ...toPixel(m),
      width: measureName(textOf(m), m.id === selected.id),
      height: NAME_HEIGHT,
      radius: symbolSize(m) / 2,
    }));
  const withRole = (m: MapMember) => {
    const bubble = bubbles?.get(m.id);
    return bubble ? `${nameOf(m)} · ${roleLabel(bubble.role)}` : nameOf(m);
  };
  // A pseudo and role finding no free spot falls back to the pseudo alone, rather than overlapping.
  const roomy =
    display.labels === "pseudoRole" && bubbles
      ? placeLabels(itemsFor(withRole), { area, everyName: false })
      : new Map<number, unknown>();
  const labelOf = (m: MapMember) => (roomy.get(m.id) ? withRole(m) : nameOf(m));
  const spots = placeLabels(itemsFor(labelOf), { area, everyName: true });
  const labelStyle = (m: MapMember, isSelected: boolean) =>
    display.labels === "none"
      ? { show: false }
      : {
          ...spotLabel(spots.get(m.id)),
          formatter: labelOf(m),
          fontWeight: isSelected ? "bold" : "normal",
          color: m.onHoliday ? COLORS.holiday : COLORS.text,
        };

  const nodes = members.map((m) => {
    const isSelected = m.id === selected.id;
    const bubble = bubbles?.get(m.id);
    if (bubble) {
      return {
        name: m.pseudo,
        value: [m.x, m.y],
        symbol: SHAPE_SYMBOLS[bubble.shape],
        symbolSize: symbolSize(m),
        itemStyle: {
          color: bubble.color,
          opacity: m.onHoliday ? 0.55 : 1,
          borderColor: COLORS.text,
          borderWidth: isSelected ? 2.5 : 0,
        },
        label: labelStyle(m, isSelected),
      };
    }
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
      symbolSize: symbolSize(m),
      itemStyle: {
        color,
        opacity: m.onHoliday ? 0.55 : 1,
        borderColor: COLORS.text,
        borderWidth: isSelected && display.sizeByTdc ? 2.5 : 0,
      },
      label: labelStyle(m, isSelected),
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
  const trip = (from: MapMember, to: MapMember, d: number, { level, estimated }: Level) =>
    `Trajet ${escapeHtml(from.pseudo)} → ${escapeHtml(to.pseudo)} : ${estimated ? "≈ " : ""}${formatDuration(travelTime(d, level) * 1000)}`;
  return {
    animation: false,
    grid,
    xAxis: mapAxis(x, step),
    yAxis: mapAxis(y, step),
    dataZoom: MAP_ZOOM,
    tooltip: {
      confine: true,
      formatter: (params: { dataType?: string; dataIndex: number }) => {
        const m = params.dataType === "node" ? members[params.dataIndex] : undefined;
        if (!m) return "";
        const lines = [
          `<b>${escapeHtml(m.pseudo)}</b> (${m.x} ; ${m.y})`,
          m.grade ? `Grade : ${escapeHtml(m.grade)}` : null,
          bubbles?.has(m.id) ? `Rôle dans la chaîne : ${roleLabel(bubbles.get(m.id)?.role ?? { kind: "out" })}` : null,
          `TDC : ${formatAmount(m.huntingField)} cm²`,
          m.onHoliday ? "En vacances" : null,
          m.masterPlayerId !== null ? "Colonisé" : null,
        ];
        if (m.id !== selected.id) {
          const d = distance(selected, m);
          lines.push(
            `Distance depuis ${escapeHtml(selected.pseudo)} : ${formatDecimal(d)}`,
            trip(selected, m, d, selectedLevel),
            trip(m, selected, d, levelOf(m.id, levels)),
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
