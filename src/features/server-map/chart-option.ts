import type { EChartsCoreOption } from "echarts/core";
import type { Player } from "@/data/exports";
import type { Level } from "@/features/alliance-map/neighbor-table";
import { distance, travelTime } from "@/game/travel";
import { CHART_COLORS } from "@/theme";
import { escapeHtml } from "@/utils/html";
import { fittedGrid, MAP_ZOOM, mapAxis, ticksFor, type MapWindow } from "@/utils/map-chart/axes";
import {
  measureName,
  NAME_HEIGHT,
  placeLabels,
  plotProjection,
  spotLabel,
  type LabelSpot,
} from "@/utils/map-chart/labels";
import { formatDecimal, formatNumber } from "@/utils/number-format";
import { formatDuration } from "@/utils/time-format";
import type { Chip } from "./selection";
import { allianceCenters } from "./view";

export interface ServerMapInput {
  /** Every player of the server, the banned left out. */
  players: readonly Player[];
  highlighted: ReadonlyMap<Player, Chip>;
  me: Player | null;
  /** Distances and trips are measured from this player. */
  reference: Player | null;
  /** Its Attack Speed. */
  level: Level;
  /** A player whose point is not set apart, even as the reference: me, with my marker hidden. */
  plainId?: number | null;
  /** Chosen alliances write their members' pseudos; otherwise their tag. */
  pseudos: boolean;
  /** Every chosen player's pseudo, whatever the zoom; where no spot is free, written where it overlaps least. */
  allNames?: boolean;
  /** The other players of the server drawn in grey (default). */
  others?: boolean;
  /** Player hovered in the table. */
  focusedId: number | null;
  /** The whole server (`fittedBounds`): the plot takes its shape. */
  axes: MapWindow;
  /** The part of the map shown, where names are placed so as not to overlap; the whole server by default. */
  view?: MapWindow;
  size: { width: number; height: number };
  /** Width of a name in pixels (a canvas measure in the page). */
  measure?: (text: string, bold: boolean) => number;
}

export const SERIES = { background: 0, chosen: 1, me: 2, tags: 3 } as const;

const colonized = (player: Player) => (player.masterPlayerId !== null ? "⛓ " : "");
const nameOf = (player: Player) => `${colonized(player)}${player.pseudo}`;

const SIZE = { chosen: 9, set: 13, me: 16 };
const DEFAULT_SPOT: LabelSpot = { position: "right", offset: [0, 0] };

function tooltipLines(player: Player, input: ServerMapInput, byId: ReadonlyMap<number, Player>): string {
  const master = player.masterPlayerId !== null ? byId.get(player.masterPlayerId) : undefined;
  const lines = [
    `<b>${escapeHtml(player.pseudo)}</b> (${String(player.x)} ; ${String(player.y)})`,
    player.alliance ? `Alliance : ${escapeHtml(player.alliance)}` : "Sans alliance",
    `TDC : ${formatNumber(player.field)} cm²`,
    player.onHoliday ? "En vacances" : null,
    player.masterPlayerId !== null ? `Colonisé par ${master ? escapeHtml(master.pseudo) : "un joueur inconnu"}` : null,
  ];
  const { reference, level } = input;
  if (reference && reference.id !== player.id) {
    const d = distance(reference, player);
    const from = escapeHtml(reference.pseudo);
    lines.push(
      `Distance depuis ${from} : ${formatDecimal(d)}`,
      `Trajet ${from} → ${escapeHtml(player.pseudo)} : ${level.estimated ? "≈ " : ""}${formatDuration(travelTime(d, level.level) * 1000)}`,
    );
  }
  return lines.filter(Boolean).join("<br>");
}

/** The whole server in the background, chosen players in their chip's colour, me, and the chosen alliances' tags. */
export function buildServerMapOption(input: ServerMapInput): EChartsCoreOption {
  const { players, highlighted, me, reference, focusedId, axes, size } = input;
  const allNames = input.allNames === true;
  const pseudos = allNames || input.pseudos;
  const byId = new Map(players.map((player) => [player.id, player]));
  const chosen = [...highlighted].filter(([player]) => player.id !== me?.id);

  const setApart = (player: Player) =>
    player.id === focusedId || (player.id === reference?.id && player.id !== input.plainId);

  // Names, best spots first: me, the reference and the hovered player, lone players, then alliance members.
  const view = input.view ?? axes;
  const grid = fittedGrid(size.width, size.height, axes);
  const { area, toPixel } = plotProjection(view, grid, size);
  const inView = (player: Player) =>
    player.x >= view.x[0] && player.x <= view.x[1] && player.y >= view.y[0] && player.y <= view.y[1];
  const named = chosen.filter(([player, chip]) => setApart(player) || chip.kind === "player" || pseudos);
  const rank = ([player, chip]: (typeof chosen)[number]) => (setApart(player) ? 0 : chip.kind === "player" ? 1 : 2);
  const measure = input.measure ?? measureName;
  const items = [
    ...(me && inView(me) ? [{ player: me, bold: true, size: SIZE.me }] : []),
    ...named
      .filter(([player]) => inView(player))
      .sort((a, b) => rank(a) - rank(b))
      .map(([player]) => ({
        player,
        bold: player.id === reference?.id,
        size: setApart(player) ? SIZE.set : SIZE.chosen,
      })),
  ].map(({ player, bold, size: symbol }) => ({
    id: player.id,
    ...toPixel(player),
    width: measure(nameOf(player), bold),
    height: NAME_HEIGHT,
    radius: symbol / 2,
  }));
  const spots = placeLabels(items, { area, everyName: allNames });

  const chosenData = chosen.map(([player, chip]) => {
    const isSet = setApart(player);
    return {
      value: [player.x, player.y],
      symbolSize: isSet ? SIZE.set : SIZE.chosen,
      itemStyle: {
        color: chip.color,
        opacity: player.onHoliday ? 0.45 : 1,
        borderColor: CHART_COLORS.text,
        borderWidth: isSet ? 2 : 0,
      },
      label: {
        ...spotLabel(spots.get(player.id)),
        formatter: nameOf(player),
        color: player.onHoliday ? CHART_COLORS.holiday : CHART_COLORS.text,
        fontWeight: player.id === reference?.id && player.id !== input.plainId ? "bold" : "normal",
      },
    };
  });

  const tags = pseudos ? [] : allianceCenters(new Map(chosen));

  return {
    animation: false,
    grid,
    xAxis: mapAxis(axes.x, undefined, ticksFor(area.right - area.left)),
    yAxis: mapAxis(axes.y, undefined, ticksFor(area.bottom - area.top)),
    dataZoom: MAP_ZOOM,
    tooltip: {
      confine: true,
      formatter: (params: { seriesIndex?: number; dataIndex: number }) => {
        const player =
          params.seriesIndex === SERIES.background
            ? players[params.dataIndex]
            : params.seriesIndex === SERIES.chosen
              ? chosen[params.dataIndex]?.[0]
              : params.seriesIndex === SERIES.me
                ? me
                : undefined;
        return player ? tooltipLines(player, input, byId) : "";
      },
    },
    series: [
      {
        type: "scatter",
        // Thousands of points (20 000 on S2): drawn in one pass.
        large: true,
        largeThreshold: 2000,
        symbolSize: 4,
        itemStyle: { color: CHART_COLORS.background },
        data: input.others === false ? [] : players.map((player) => [player.x, player.y]),
        emphasis: { disabled: true },
      },
      {
        type: "scatter",
        data: chosenData,
        label: { fontSize: 12 },
        emphasis: { scale: false },
      },
      {
        type: "scatter",
        data: me
          ? [
              {
                value: [me.x, me.y],
                symbol: "diamond",
                symbolSize: SIZE.me,
                itemStyle: {
                  color: highlighted.get(me)?.color ?? CHART_COLORS.selected,
                  borderColor: CHART_COLORS.selected,
                  borderWidth: me.id === reference?.id ? 3 : 2,
                },
                // Always written: where no spot is free, to the right as before.
                label: { ...spotLabel(spots.get(me.id) ?? DEFAULT_SPOT), formatter: nameOf(me), fontWeight: "bold" },
              },
            ]
          : [],
        label: { fontSize: 12, color: CHART_COLORS.text },
        z: 4,
        emphasis: { scale: false },
      },
      {
        type: "scatter",
        silent: true,
        symbolSize: 0,
        data: tags.map((tag) => ({
          value: [tag.x, tag.y],
          label: { formatter: tag.tag, color: tag.color },
        })),
        label: {
          show: true,
          position: "inside",
          fontSize: 15,
          fontWeight: "bold",
          textBorderColor: CHART_COLORS.halo,
          textBorderWidth: 3,
        },
        labelLayout: { hideOverlap: true },
        z: 5,
      },
    ],
  };
}

/** The player under a click on the map, if any. */
export function playerAt(
  input: Pick<ServerMapInput, "players" | "highlighted" | "me">,
  event: { seriesIndex?: number; dataIndex: number },
): Player | undefined {
  if (event.seriesIndex === SERIES.background) return input.players[event.dataIndex];
  if (event.seriesIndex === SERIES.chosen)
    return [...input.highlighted.keys()].filter((player) => player.id !== input.me?.id)[event.dataIndex];
  if (event.seriesIndex === SERIES.me) return input.me ?? undefined;
  return undefined;
}
