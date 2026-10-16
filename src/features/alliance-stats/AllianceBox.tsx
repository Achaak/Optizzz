import { useMemo } from "react";
import type { AllianceRanking } from "@/game/pages/alliance-ranking";
import { Controls, LoadingNote } from "@/utils/history-chart/controls";
import { formatGain, formatPercent } from "@/utils/history-chart/format";
import { HistoryChart } from "@/utils/history-chart/HistoryChart";
import { periodProgress } from "@/utils/history-chart/progress";
import { useStoredSettings } from "@/utils/useStoredSettings";
import { AverageToggle } from "./common";
import { STATS_LINK } from "./menu";
import { ALLIANCE_METRICS } from "./metrics";
import { allianceSeries, type AllianceMetric } from "./series";
import { readAllianceStatsSettings, writeAllianceStatsSettings } from "./settings";
import { useAllianceHistory } from "./useAllianceHistory";

interface Props {
  origin: string;
  /** The alliance of the page, from its address. */
  tag: string;
  /** Read on the page: its live scores. */
  ranking: AllianceRanking;
  liveTime: Date;
  /** From the page header; null outside an alliance. */
  myTag: string | null;
  /** Whether the « Statistiques » view is on, for the links. */
  statsView: boolean;
}

/** « Progression » box under the « Classement » table of an alliance's page. */
export function AllianceBox({ origin, tag, ranking, liveTime, myTag, statsView }: Props) {
  const host = new URL(origin).host;
  const [settings, updateSettings] = useStoredSettings(host, readAllianceStatsSettings, writeAllianceStatsSettings);
  const { snapshots, total, loading, error } = useAllianceHistory(origin, settings?.days);

  const metric = settings?.metric ?? "field";
  const average = (settings?.average ?? false) && metric !== "members";
  const points = useMemo(
    () => allianceSeries(snapshots, tag, metric, average, { time: liveTime, scores: ranking.scores }),
    [snapshots, tag, metric, average, liveTime, ranking.scores],
  );
  const progress = periodProgress(points);

  if (error)
    return (
      <div className="history optizzz-panel compact optizzz-panel--danger">Statistiques indisponibles : {error}</div>
    );
  if (!settings) return <div className="history optizzz-panel compact">Chargement des statistiques…</div>;

  const mine = myTag !== null && myTag.toLowerCase() === tag.toLowerCase();
  // Adds the alliance to the view's comparisons before going there.
  const compare = async () => {
    const stored = await readAllianceStatsSettings(host);
    const known = stored.compared.some((other) => other.toLowerCase() === tag.toLowerCase());
    if (!known) await writeAllianceStatsSettings(host, { ...stored, compared: [...stored.compared, tag] });
    location.href = STATS_LINK;
  };

  return (
    <div className="history optizzz-panel compact">
      <h4>Progression</h4>
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
      <HistoryChart curves={[{ name: tag, points, highlight: true }]} compact />
      <p className="summary">
        {progress && points.length > 1 ? (
          <>
            Sur la période : <b className={progress.gain < 0 ? "down" : ""}>{formatGain(Math.round(progress.gain))}</b>{" "}
            ({formatPercent(progress.percent)})
          </>
        ) : loading ? null : (
          "Pas encore dans l'export public."
        )}
        {statsView && myTag !== null && (
          <>
            {" · "}
            {mine ? (
              <a href={STATS_LINK}>Voir les statistiques</a>
            ) : (
              <button type="button" className="optizzz-button-link" onClick={() => void compare()}>
                Comparer avec mon alliance
              </button>
            )}
          </>
        )}
      </p>
    </div>
  );
}
