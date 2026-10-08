import { useCallback, useEffect, useMemo, useState } from "react";
import type { Scores } from "./api";
import { Controls, LoadingNote } from "./controls";
import { formatGain, formatPercent } from "./format";
import { HistoryChart } from "./HistoryChart";
import { HISTORY_LINK } from "./menu";
import { periodProgress, playerSeries } from "./series";
import { readHistorySettings, writeHistorySettings, type HistorySettings } from "./settings";
import { useHistory } from "./useHistory";

interface Props {
  origin: string;
  loggedInPseudo: string | null;
  /** The profile's player and their scores, read on the page. */
  profile: { pseudo: string; scores: Scores };
  liveTime: Date;
  /** Whether the alliance view is on, for the « Comparer » link. */
  allianceView: boolean;
}

export function ProfileHistory({ origin, loggedInPseudo, profile, liveTime, allianceView }: Props) {
  const host = new URL(origin).host;
  const [settings, setSettings] = useState<HistorySettings | null>(null);
  const { playersExport, snapshots, total, loading, error } = useHistory(origin, settings?.days);

  useEffect(() => {
    void readHistorySettings(host).then(setSettings);
  }, [host]);

  const updateSettings = useCallback(
    (update: (current: HistorySettings) => HistorySettings) =>
      setSettings((current) => {
        if (!current) return current;
        const next = update(current);
        void writeHistorySettings(host, next);
        return next;
      }),
    [host],
  );

  const player = playersExport?.players.find((p) => p.pseudo === profile.pseudo) ?? null;
  const me = playersExport?.players.find((p) => p.pseudo === loggedInPseudo) ?? null;
  const metric = settings?.metric ?? "field";
  const points = useMemo(
    () => (player ? playerSeries(snapshots, player.id, metric, { time: liveTime, scores: profile.scores }) : []),
    [player, snapshots, metric, liveTime, profile.scores],
  );
  const progress = periodProgress(points);

  if (error) return <div className="history compact error">Historique indisponible : {error}</div>;
  if (!settings || !playersExport) return <div className="history compact">Chargement de l'historique…</div>;
  if (!player) return <div className="history compact">{profile.pseudo} n'est pas encore dans les exports.</div>;

  const sameAlliance = allianceView && player.alliance !== null && player.alliance === me?.alliance;
  // Adds the player to the alliance view's curves before going there.
  const compare = async () => {
    const stored = await readHistorySettings(host);
    const selected = stored.selected.length > 0 ? stored.selected : me ? [me.id] : [];
    if (!selected.includes(player.id)) selected.push(player.id);
    await writeHistorySettings(host, { ...stored, selected });
    location.href = HISTORY_LINK;
  };

  return (
    <div className="history compact">
      <h4>Progression</h4>
      <Controls
        metric={metric}
        days={settings.days}
        onMetric={(next) => updateSettings((current) => ({ ...current, metric: next }))}
        onDays={(next) => updateSettings((current) => ({ ...current, days: next }))}
      />
      <LoadingNote loaded={snapshots.length} total={total} loading={loading} />
      <HistoryChart curves={[{ name: player.pseudo, points, highlight: true }]} compact />
      <p className="summary">
        {progress ? (
          <>
            Sur la période : <b className={progress.gain < 0 ? "down" : ""}>{formatGain(progress.gain)}</b> (
            {formatPercent(progress.percent)})
          </>
        ) : (
          "Aucun export sur la période."
        )}
        {sameAlliance && (
          <>
            {" · "}
            <button className="link" onClick={() => void compare()}>
              Comparer avec l'alliance
            </button>
          </>
        )}
      </p>
    </div>
  );
}
