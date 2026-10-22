import type { EChartsCoreOption } from "echarts/core";
import type { Player } from "@optizzz/game/exports";
import { levelOf, type KnownLevels } from "./neighbor-table";
import { kNearestLinks, membersByDistance } from "./neighbors";
import { distance, travelTime } from "@optizzz/game/travel";
import { SHAPE_SYMBOLS, type MemberBubble } from "@/features/tdc-chain/role-styles";
import { roleLabel } from "@/features/tdc-chain/roles";
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

export function buildChartOption(
  members: readonly MapMember[],
  selected: MapMember,
  k: number,
  levels: KnownLevels,
  size: { width: number; height: number },
  /** Chain roles shown: each member's bubble; the selected player is then ringed instead of coloured. */
  bubbles: ReadonlyMap<number, MemberBubble> | null = null,
): EChartsCoreOption {
  const selectedNeighbors = new Set(
    membersByDistance(selected, members)
      .slice(0, k)
      .map((n) => n.player.id),
  );
  const indexById = new Map(members.map((m, i) => [m.id, i]));
  const { x, y, step } = bounds(members);
  const grid = squareGrid(size.width, size.height);
  const symbolSize = (m: MapMember) => {
    const bubble = bubbles?.get(m.id);
    if (bubble) return bubble.px + (m.id === selected.id ? 4 : 0);
    return m.id === selected.id ? 16 : 11;
  };

  // Every pseudo is written, the selected player's first: placed at the full view, they stay apart when zooming in.
  const { area, toPixel } = plotProjection({ x, y }, grid, size);
  const spots = placeLabels(
    [selected, ...members.filter((m) => m.id !== selected.id)].map((m) => ({
      id: m.id,
      ...toPixel(m),
      width: measureName(nameOf(m), m.id === selected.id),
      height: NAME_HEIGHT,
      radius: symbolSize(m) / 2,
    })),
    { area, everyName: true },
  );

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
        label: {
          ...spotLabel(spots.get(m.id)),
          formatter: nameOf(m),
          fontWeight: isSelected ? "bold" : "normal",
          color: m.onHoliday ? COLORS.holiday : COLORS.text,
        },
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
      itemStyle: { color, opacity: m.onHoliday ? 0.55 : 1 },
      label: {
        ...spotLabel(spots.get(m.id)),
        formatter: nameOf(m),
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
