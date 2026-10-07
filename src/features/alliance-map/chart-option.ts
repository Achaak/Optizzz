import type { EChartsCoreOption } from "echarts/core";
import type { Player } from "./api";
import { levelOf, type KnownLevels } from "./neighbor-table";
import { distance, kNearestLinks, membersByDistance } from "./neighbors";
import { travelTime } from "@/game/travel";
import { formatDuration } from "./travel";

export interface MapMember extends Player {
  /** Hunting field read live on the members page, otherwise the export's. */
  huntingField: number;
}

const COLORS = {
  selected: "#c0392b",
  neighbor: "#e67e22",
  member: "#2e6da4",
  holiday: "#a0a0a0",
  link: "rgba(80, 80, 80, 0.35)",
  selectedLink: "#c0392b",
};

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const numberFormat = new Intl.NumberFormat("fr-FR");

/** Same range on both axes, so distances are not distorted. */
function bounds(members: readonly Pick<MapMember, "x" | "y">[]) {
  const xs = members.map((m) => m.x);
  const ys = members.map((m) => m.y);
  const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
  const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;
  const half = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 4) / 2 + 2;
  return {
    x: [Math.floor(centerX - half), Math.ceil(centerX + half)] as const,
    y: [Math.floor(centerY - half), Math.ceil(centerY + half)] as const,
  };
}

export function buildChartOption(
  members: readonly MapMember[],
  selected: MapMember,
  k: number,
  levels: KnownLevels,
): EChartsCoreOption {
  const selectedNeighbors = new Set(
    membersByDistance(selected, members)
      .slice(0, k)
      .map((n) => n.player.id),
  );
  const indexById = new Map(members.map((m, i) => [m.id, i]));
  const { x, y } = bounds(members);

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
        color: m.onHoliday ? COLORS.holiday : "#222",
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

  return {
    animation: false,
    // Wide right margin: labels sit to the right of the points.
    grid: { left: 40, right: 90, top: 16, bottom: 32 },
    xAxis: { type: "value", min: x[0], max: x[1], splitLine: dashedGrid },
    yAxis: { type: "value", min: y[0], max: y[1], splitLine: dashedGrid },
    dataZoom: [
      { type: "inside", xAxisIndex: 0, filterMode: "none" },
      { type: "inside", yAxisIndex: 0, filterMode: "none" },
    ],
    tooltip: {
      confine: true,
      formatter: (params: { dataType?: string; dataIndex: number }) => {
        const m = params.dataType === "node" ? members[params.dataIndex] : undefined;
        if (!m) return "";
        const lines = [
          `<b>${escapeHtml(m.pseudo)}</b> (${m.x} ; ${m.y})`,
          m.grade ? `Grade : ${escapeHtml(m.grade)}` : null,
          `TDC : ${numberFormat.format(m.huntingField)} cm²`,
          m.onHoliday ? "En vacances" : null,
          m.masterPlayerId !== null ? "Colonisé" : null,
        ];
        if (m.id !== selected.id) {
          const d = distance(selected, m);
          lines.push(
            `Distance depuis ${escapeHtml(selected.pseudo)} : ${d.toFixed(1)}`,
            `Trajet ${escapeHtml(selected.pseudo)} → ${escapeHtml(m.pseudo)} : ${selectedLevel.estimated ? "≈ " : ""}${formatDuration(travelTime(d, selectedLevel.level))}`,
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
