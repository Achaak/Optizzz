"use client";

import type { Player } from "@optizzz/game/exports";
import type { Level } from "@optizzz/game/travel";
import { fittedGrid, fittedHeight, type AxisRange, type MapWindow } from "@optizzz/map/axes";
import { buildServerMapOption, playerAt } from "@optizzz/map/chart-option";
import type { MapPalette } from "@optizzz/map/palette";
import type { Chip } from "@optizzz/map/selection";
import { useMapChart } from "@optizzz/map/use-map-chart";
import { showPseudos, type ZoomRequest } from "@optizzz/map/view";
import { ScatterChart } from "echarts/charts";
import { DataZoomComponent, GridComponent, TooltipComponent } from "echarts/components";
import * as echarts from "echarts/core";
import { LabelLayout } from "echarts/features";
import { CanvasRenderer } from "echarts/renderers";
import ReactECharts from "echarts-for-react/esm/core";
import { useEffect, useMemo, useState } from "react";
import { Button } from "~/components/ui/button";

echarts.use([ScatterChart, GridComponent, TooltipComponent, DataZoomComponent, LabelLayout, CanvasRenderer]);

interface ChartEvent {
  seriesIndex?: number;
  dataIndex: number;
}

export interface MapDisplay {
  /** The players not chosen, in grey. */
  others: boolean;
  /** Every chosen player's pseudo, whatever the zoom. */
  allNames: boolean;
}

interface Props {
  palette: MapPalette;
  players: readonly Player[];
  highlighted: ReadonlyMap<Player, Chip>;
  reference: Player | null;
  level: Level;
  focusedId: number | null;
  axes: MapWindow;
  zoom: ZoomRequest | null;
  display: MapDisplay;
  onDisplay: (change: Partial<MapDisplay>) => void;
  onFrame: () => void;
  onZoom: (request: ZoomRequest) => void;
  onReference: (player: Player) => void;
  onOpen: (player: Player) => void;
}

/** The map fits the window: its bottom is seen without scrolling, on a phone too. */
const maxHeight = () => Math.max(320, Math.min(720, window.innerHeight - 200));

/** The server's map: every player in grey, the chosen ones in their chip's colour (docs/features/site-carte.md). */
export function MapChart(props: Props) {
  const { palette, players, highlighted, reference, level, focusedId, axes, zoom, display } = props;
  const { chartRef, boxRef, width, height, zoomTo, resetZoom } = useMapChart((boxWidth) =>
    fittedHeight(boxWidth, maxHeight(), axes),
  );
  /** Zoomed or moved by hand, after the last request. */
  const [userView, setUserView] = useState<{ x: AxisRange; y: AxisRange; at: number } | null>(null);
  const view = userView && (!zoom || userView.at > zoom.at) ? userView : zoom && !zoom.full ? zoom : axes;
  const chosen = useMemo(() => [...highlighted.keys()], [highlighted]);
  const pseudos = showPseudos(view, chosen);

  const option = useMemo(
    () =>
      buildServerMapOption({
        palette,
        players,
        highlighted,
        me: null,
        reference,
        level,
        pseudos,
        allNames: display.allNames,
        others: display.others,
        focusedId,
        axes,
        view,
        size: { width, height },
      }),
    [palette, players, highlighted, reference, level, pseudos, display, focusedId, axes, view, width, height],
  );

  // Drawn once the width is known; a request waits for ECharts' first render (with `lazyUpdate`, its grid does not
  // exist before), or it is ignored.
  const drawn = width > 0;
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!ready || !zoom) return;
    if (zoom.full) resetZoom();
    else zoomTo(zoom.x, zoom.y);
  }, [ready, zoom, resetZoom, zoomTo]);

  const onEvents = {
    finished: () => setReady(true),
    click: (event: ChartEvent) => {
      const player = playerAt({ players, highlighted, me: null }, event);
      if (player) props.onReference(player);
    },
    dblclick: (event: ChartEvent) => {
      const player = playerAt({ players, highlighted, me: null }, event);
      if (player) props.onOpen(player);
    },
    // Zoomed or moved by hand: pseudos or tags, from the corners of the plot area once the zoom is applied.
    datazoom: () => {
      const at = Date.now();
      setTimeout(() => {
        const chart = chartRef.current?.getEchartsInstance();
        if (!chart) return;
        const grid = fittedGrid(width, height, axes);
        const toMap = (pixel: number[]) =>
          chart.convertFromPixel({ gridIndex: 0 }, pixel) as [number, number] | undefined;
        const corner = toMap([grid.left, height - grid.bottom]);
        const opposite = toMap([width - grid.right, grid.top]);
        // While ECharts rebuilds its grid (a new option), there is nothing to read yet.
        if (!corner || !opposite) return;
        setUserView({ x: [corner[0], opposite[0]], y: [corner[1], opposite[1]], at });
      }, 0);
    },
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <fieldset className="flex flex-wrap gap-4">
          <legend className="sr-only">Afficher</legend>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={display.others}
              onChange={(event) => props.onDisplay({ others: event.target.checked })}
            />
            les autres joueurs
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={display.allNames}
              onChange={(event) => props.onDisplay({ allNames: event.target.checked })}
            />
            tous les noms
          </label>
        </fieldset>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={props.onFrame}>
            Cadrer la sélection
          </Button>
          <Button variant="outline" size="sm" onClick={() => props.onZoom({ full: true, at: Date.now() })}>
            Voir tout le serveur
          </Button>
        </div>
      </div>
      <div ref={boxRef} className="rounded-xl border">
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
      <p className="text-sm text-muted-foreground">
        Ctrl + molette ou pincer : zoom · Glisser : déplacer · Clic : distances depuis ce joueur · Double-clic : sa
        fiche
      </p>
    </div>
  );
}
