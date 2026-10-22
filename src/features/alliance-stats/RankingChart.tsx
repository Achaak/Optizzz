import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { sameTag } from "@/game/diplomacy";
import type { Curve } from "@/utils/history-chart/chart-option";
import { Controls, LoadingNote } from "@/utils/history-chart/controls";
import { HistoryChart } from "@/utils/history-chart/HistoryChart";
import { useStoredSettings } from "@/utils/useStoredSettings";
import { AverageToggle } from "./common";
import { STATS_LINK } from "./menu";
import { ALLIANCE_METRICS } from "./metrics";
import { assignColors, MAX_SHOWN, type CurveCell } from "./ranking";
import { allianceSeries, type AllianceMetric } from "./series";
import { readAllianceStatsSettings, writeAllianceStatsSettings } from "./settings";
import { useAllianceHistory } from "./useAllianceHistory";

interface Props {
  origin: string;
  /** From the page header; null outside an alliance. */
  myTag: string | null;
  /** The « Graphique » cell of each alliance of the page, filled with its checkbox. */
  cells: readonly CurveCell[];
  /** Whether the « Statistiques » view is on, for its link. */
  statsView: boolean;
}

const sameColors = (a: ReadonlyMap<string, string>, b: ReadonlyMap<string, string>) =>
  a.size === b.size && [...a].every(([tag, color]) => b.get(tag) === color);

/**
 * « Comparer les alliances », over the alliances' ranking: the curves of the alliances ticked in its « Graphique »
 * column. The ticked ones are the alliances compared in the « Statistiques » view, mine always shown.
 */
export function RankingChart({ origin, myTag, cells, statsView }: Props) {
  const host = new URL(origin).host;
  const [settings, updateSettings] = useStoredSettings(host, readAllianceStatsSettings, writeAllianceStatsSettings);
  const { alliancesExport, snapshots, total, loading, error } = useAllianceHistory(origin, settings?.days);

  const metric = settings?.metric ?? "field";
  const average = (settings?.average ?? false) && metric !== "members";
  const compared = useMemo(
    () => (settings?.compared ?? []).filter((tag) => !myTag || !sameTag(tag, myTag)),
    [settings?.compared, myTag],
  );
  const shown = useMemo(() => [...(myTag ? [myTag] : []), ...compared], [myTag, compared]);

  // Kept from one render to the next: an alliance does not change colour when another is ticked or unticked.
  // Set during the render, React draws again at once with the new colours.
  const [colors, setColors] = useState<ReadonlyMap<string, string>>(new Map());
  const nextColors = assignColors(shown, colors);
  if (!sameColors(nextColors, colors)) setColors(nextColors);

  const curves = useMemo<Curve[]>(
    () =>
      shown.map((tag) => ({
        name: tag,
        points: allianceSeries(snapshots, tag, metric, average),
        highlight: myTag !== null && sameTag(tag, myTag),
        color: colors.get(tag),
      })),
    [shown, snapshots, metric, average, myTag, colors],
  );

  const nameOf = (tag: string) => alliancesExport?.alliances.find((alliance) => sameTag(alliance.tag, tag))?.name;
  const isShown = (tag: string) => shown.some((other) => sameTag(other, tag));
  const full = shown.length >= MAX_SHOWN;

  const toggle = (tag: string, on: boolean) =>
    updateSettings((current) => {
      const rest = current.compared.filter((other) => !sameTag(other, tag));
      return { ...current, compared: on ? [...rest, tag] : rest };
    });
  const clear = () => updateSettings((current) => ({ ...current, compared: [] }));

  const checkboxes = cells.map(({ tag, cell }) => {
    const mine = myTag !== null && sameTag(tag, myTag);
    const checked = isShown(tag);
    const blocked = !checked && full;
    const title = mine
      ? "Votre alliance : toujours sur le graphique"
      : blocked
        ? `${String(MAX_SHOWN)} alliances au plus sur le graphique : décochez-en une.`
        : checked
          ? `Retirer ${tag} du graphique`
          : `Afficher ${tag} sur le graphique`;
    return createPortal(
      <label title={title}>
        <input
          type="checkbox"
          checked={checked}
          disabled={!settings || mine || blocked}
          aria-label={title}
          onChange={(event) => toggle(tag, event.currentTarget.checked)}
        />
        <span
          className="optizzz-ranking-swatch"
          style={{ background: checked ? (colors.get(tag) ?? "transparent") : "transparent" }}
        />
      </label>,
      cell,
      tag,
    );
  });

  if (error)
    return (
      <div className="history optizzz-panel compact optizzz-panel--danger">Statistiques indisponibles : {error}</div>
    );
  if (!settings)
    return (
      <>
        <div className="history optizzz-panel compact">Chargement des statistiques…</div>
        {checkboxes}
      </>
    );

  return (
    <div className="history optizzz-panel compact ranking-chart">
      <h4>Comparer les alliances</h4>
      <Controls
        metrics={ALLIANCE_METRICS}
        metric={metric}
        days={settings.days}
        onMetric={(next: AllianceMetric) => updateSettings((current) => ({ ...current, metric: next }))}
        onDays={(next) => updateSettings((current) => ({ ...current, days: next }))}
      >
        {metric !== "members" && (
          <AverageToggle
            checked={settings.average}
            onChange={(next) => updateSettings((current) => ({ ...current, average: next }))}
          />
        )}
      </Controls>
      <LoadingNote loaded={snapshots.length} total={total} loading={loading} />

      {shown.length === 0 ? (
        <p className="optizzz-note empty">
          Cochez des alliances dans la colonne « Graphique » du tableau pour comparer leurs courbes.
        </p>
      ) : (
        <>
          <HistoryChart curves={curves} legend={false} />
          <ul className="optizzz-chips curve-legend" aria-label="Alliances sur le graphique">
            {curves.map((curve) => {
              const mine = curve.highlight === true;
              return (
                <li key={curve.name} className="optizzz-chip">
                  <span className="swatch" style={{ background: curve.color }} aria-hidden="true" />
                  <a
                    href={`classementAlliance.php?alliance=${encodeURIComponent(curve.name)}`}
                    title={nameOf(curve.name)}
                    className={mine ? "mine" : undefined}
                  >
                    {curve.name}
                  </a>
                  {mine && <span className="optizzz-muted">(vous)</span>}
                  {!loading && curve.points.length === 0 && <span className="optizzz-muted">pas dans l'export</span>}
                  {!mine && (
                    <button
                      type="button"
                      className="optizzz-button-link"
                      aria-label={`Retirer ${curve.name} du graphique`}
                      title="Retirer du graphique"
                      onClick={() => toggle(curve.name, false)}
                    >
                      ✕
                    </button>
                  )}
                </li>
              );
            })}
            {compared.length > 1 && (
              <li>
                <button type="button" className="optizzz-button-link" onClick={clear}>
                  Tout retirer
                </button>
              </li>
            )}
          </ul>
        </>
      )}

      <p className="optizzz-note">
        Un point par jour (l'export des alliances de minuit). {MAX_SHOWN} alliances au plus
        {myTag ? ", la vôtre comprise" : ""} ; celles des autres pages du classement restent cochées.
        {statsView && myTag && (
          <>
            {" "}
            <a href={STATS_LINK}>Les mêmes dans Statistiques</a>
          </>
        )}
      </p>
      {checkboxes}
    </div>
  );
}
