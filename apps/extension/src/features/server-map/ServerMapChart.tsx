import { ScatterChart } from "echarts/charts";
import { DataZoomComponent, GridComponent, TooltipComponent } from "echarts/components";
import * as echarts from "echarts/core";
import { LabelLayout } from "echarts/features";
import { CanvasRenderer } from "echarts/renderers";
// The ESM build: the CommonJS one (lib/core) resolves to the module object instead of the component.
import ReactECharts from "echarts-for-react/esm/core";
import { useEffect, useMemo, useState } from "react";
import type { Player } from "@optizzz/game/exports";
import type { Level } from "@/features/alliance-map/neighbor-table";
import { fittedGrid, fittedHeight, type AxisRange, type MapWindow } from "@/utils/map-chart/axes";
import { useMapChart } from "@/utils/map-chart/useMapChart";
import { buildServerMapOption, playerAt } from "./chart-option";
import type { Chip } from "./selection";
import type { MapDisplay } from "./settings";
import { showPseudos, type ZoomRequest } from "./view";

echarts.use([ScatterChart, GridComponent, TooltipComponent, DataZoomComponent, LabelLayout, CanvasRenderer]);

interface ChartEvent {
  seriesIndex?: number;
  dataIndex: number;
}

interface Props {
  players: readonly Player[];
  highlighted: ReadonlyMap<Player, Chip>;
  me: Player | null;
  /** « Afficher : » my marker (hidden, I am a point of my alliance like the others), the other players, every name. */
  display: MapDisplay;
  onDisplay: (change: Partial<MapDisplay>) => void;
  reference: Player | null;
  level: Level;
  focusedId: number | null;
  /** The whole server (`fittedBounds`): the plot takes its shape. */
  axes: MapWindow;
  /** The part of the map asked last: opening, a chip added, the table's magnifier, the buttons. */
  zoom: ZoomRequest | null;
  /** « Réinitialiser le zoom »: back to the chosen players. */
  onFrame: () => void;
  onZoom: (request: ZoomRequest) => void;
  onReference: (player: Player) => void;
  onOpenProfile: (player: Player) => void;
}

const MAX_HEIGHT = 720;
/** What stays visible above the map in the window: title, search, chips, toolbar. */
const ABOVE_MAP = 230;

/** The map fits the window (the in-game dialog or a tab): its bottom is seen without scrolling. */
const maxHeight = () => Math.max(320, Math.min(MAX_HEIGHT, window.innerHeight - ABOVE_MAP));

interface View {
  x: AxisRange;
  y: AxisRange;
}

export function ServerMapChart(props: Props) {
  const {
    players,
    highlighted,
    me,
    display,
    onDisplay,
    reference,
    level,
    focusedId,
    axes,
    zoom,
    onFrame,
    onZoom,
    onReference,
    onOpenProfile,
  } = props;
  const { showMe, others, allNames } = display;
  /** Drawn apart with its marker; hidden, I am drawn as a member of my alliance's chip. */
  const marked = showMe ? me : null;
  const { chartRef, boxRef, width, height, zoomTo, resetZoom } = useMapChart((width) =>
    fittedHeight(width, maxHeight(), axes),
  );
  /** Zoomed or moved by hand, after the last request. */
  const [userView, setUserView] = useState<(View & { at: number }) | null>(null);
  const view: View = userView && (!zoom || userView.at > zoom.at) ? userView : zoom && !zoom.full ? zoom : axes;

  const chosen = useMemo(() => [...highlighted.keys()], [highlighted]);
  const pseudos = showPseudos(view, chosen);
  const option = useMemo(
    () =>
      buildServerMapOption({
        players,
        highlighted,
        me: marked,
        plainId: showMe ? null : (me?.id ?? null),
        reference,
        level,
        pseudos,
        allNames,
        others,
        focusedId,
        axes,
        view,
        size: { width, height },
      }),
    [
      players,
      highlighted,
      marked,
      showMe,
      me,
      reference,
      level,
      pseudos,
      allNames,
      others,
      focusedId,
      axes,
      view,
      width,
      height,
    ],
  );

  // The chart is drawn once the width is known: a request made before waits for it.
  const drawn = width > 0;
  useEffect(() => {
    if (!drawn || !zoom) return;
    if (zoom.full) resetZoom();
    else zoomTo(zoom.x, zoom.y);
  }, [drawn, zoom, resetZoom, zoomTo]);

  const onEvents = {
    click: (event: ChartEvent) => {
      const player = playerAt({ players, highlighted, me: marked }, event);
      if (player) onReference(player);
    },
    dblclick: (event: ChartEvent) => {
      const player = playerAt({ players, highlighted, me: marked }, event);
      if (player) onOpenProfile(player);
    },
    // Zoomed or moved by hand: pseudos or tags, from the corners of the plot area once the zoom is applied.
    datazoom: () => {
      const at = Date.now();
      setTimeout(() => {
        const chart = chartRef.current?.getEchartsInstance();
        if (!chart) return;
        const grid = fittedGrid(width, height, axes);
        const toMap = (pixel: number[]) => chart.convertFromPixel({ gridIndex: 0 }, pixel) as [number, number];
        const [left, bottom] = toMap([grid.left, height - grid.bottom]);
        const [right, top] = toMap([width - grid.right, grid.top]);
        setUserView({ x: [left, right], y: [bottom, top], at });
      }, 0);
    },
  };

  return (
    <div className="chart optizzz-well">
      <div className="chart-toolbar">
        <fieldset className="display">
          <legend>Afficher :</legend>
          {me && (
            <label className="show-me">
              <input
                type="checkbox"
                checked={showMe}
                onChange={(event) => onDisplay({ showMe: event.target.checked })}
              />{" "}
              ma position
            </label>
          )}
          <label className="others" title="Les joueurs non choisis, en gris">
            <input type="checkbox" checked={others} onChange={(event) => onDisplay({ others: event.target.checked })} />{" "}
            les autres joueurs
          </label>
          <label className="all-names" title="Le pseudo de chaque joueur choisi, même dézoomé">
            <input
              type="checkbox"
              checked={allNames}
              onChange={(event) => onDisplay({ allNames: event.target.checked })}
            />{" "}
            tous les noms
          </label>
        </fieldset>
        <div className="zoom-buttons">
          <button type="button" onClick={onFrame} title="Revenir sur vous et les joueurs ou alliances choisis">
            Cadrer la sélection
          </button>
          <button
            type="button"
            onClick={() => onZoom({ full: true, at: Date.now() })}
            title="Dézoomer pour voir toute la carte du serveur"
          >
            Voir tout le serveur
          </button>
        </div>
      </div>
      <div ref={boxRef}>
        {drawn && (
          <ReactECharts
            ref={chartRef}
            echarts={echarts}
            option={option}
            onEvents={onEvents}
            lazyUpdate
            style={{ width: "100%", height }}
          />
        )}
      </div>
      <p className="optizzz-note">
        <span className="hint-mouse">
          Ctrl + molette : zoom · Glisser : déplacer · Clic : distances depuis ce joueur · Double-clic : profil
        </span>
        <span className="hint-touch">
          Pincer : zoom · Glisser : déplacer · Toucher un joueur : distances depuis lui
        </span>
      </p>
    </div>
  );
}
