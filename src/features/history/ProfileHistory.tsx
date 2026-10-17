import { useMemo } from "react";
import type { Scores } from "./api";
import { allianceMoves, moveDays, type AllianceMove } from "./alliance-moves";
import { Controls, LoadingNote } from "@/utils/history-chart/controls";
import { METRICS } from "./metrics";
import { formatGain, formatPercent } from "@/utils/history-chart/format";
import { HistoryChart } from "@/utils/history-chart/HistoryChart";
import { HISTORY_LINK } from "./menu";
import { periodProgress, playerSeries } from "./series";
import { readHistorySettings, writeHistorySettings } from "./settings";
import { useHistory } from "./useHistory";
import { useStoredSettings } from "@/utils/useStoredSettings";

interface Props {
  origin: string;
  loggedInPseudo: string | null;
  /** The profile's player and their scores, read on the page. */
  profile: { pseudo: string; scores: Partial<Scores> };
  liveTime: Date;
  /** Whether the alliance view is on, for the « Comparer » link. */
  allianceView: boolean;
}

export function ProfileHistory({ origin, loggedInPseudo, profile, liveTime, allianceView }: Props) {
  const host = new URL(origin).host;
  const [settings, updateSettings] = useStoredSettings(host, readHistorySettings, writeHistorySettings);
  const { playersExport, snapshots, total, loading, error } = useHistory(origin, settings?.days);

  const player = playersExport?.players.find((p) => p.pseudo === profile.pseudo) ?? null;
  const me = playersExport?.players.find((p) => p.pseudo === loggedInPseudo) ?? null;
  const metric = settings?.metric ?? "field";
  const points = useMemo(
    () => (player ? playerSeries(snapshots, player.id, metric, { time: liveTime, scores: profile.scores }) : []),
    [player, snapshots, metric, liveTime, profile.scores],
  );
  const progress = periodProgress(points);
  const moves = useMemo(
    () =>
      player
        ? allianceMoves(snapshots, player.id, { version: playersExport?.version ?? "", alliance: player.alliance })
        : [],
    [player, snapshots, playersExport?.version],
  );

  if (error)
    return <div className="history optizzz-panel compact optizzz-panel--danger">Historique indisponible : {error}</div>;
  if (!settings || !playersExport)
    return <div className="history optizzz-panel compact">Chargement de l'historique…</div>;
  if (!player)
    return <div className="history optizzz-panel compact">{profile.pseudo} n'est pas encore dans les exports.</div>;

  // On my own profile, the alliance view already shows my curve.
  const sameAlliance =
    allianceView && player.id !== me?.id && player.alliance !== null && player.alliance === me?.alliance;
  // Adds the player to the alliance view's curves before going there.
  const compare = async () => {
    const stored = await readHistorySettings(host);
    const selected = stored.selected.length > 0 ? stored.selected : me ? [me.id] : [];
    if (!selected.includes(player.id)) selected.push(player.id);
    await writeHistorySettings(host, { ...stored, selected });
    location.href = HISTORY_LINK;
  };

  return (
    <div className="history optizzz-panel compact">
      <h4>Progression</h4>
      <Controls
        metrics={METRICS}
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
            <button className="optizzz-button-link" onClick={() => void compare()}>
              Comparer avec l'alliance
            </button>
          </>
        )}
      </p>
      {snapshots.length > 0 &&
        (moves.length > 0 ? (
          <>
            <p className="summary">Changements d'alliance sur la période :</p>
            <ul className="moves">
              {moves.map((move) => (
                <li key={move.before}>
                  <b>{moveDays(move)}</b> · <Move move={move} />
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="summary optizzz-muted">
            {player.alliance ? (
              <>
                Toujours dans <AllianceLink tag={player.alliance} /> sur la période.
              </>
            ) : (
              "Sans alliance sur toute la période."
            )}
          </p>
        ))}
    </div>
  );
}

const AllianceLink = ({ tag }: { tag: string }) => (
  <a href={`classementAlliance.php?alliance=${encodeURIComponent(tag)}`}>{tag}</a>
);

/** « a quitté ABC pour XYZ ». */
function Move({ move }: { move: AllianceMove }) {
  if (move.from === null && move.to !== null)
    return (
      <>
        a rejoint <AllianceLink tag={move.to} />
      </>
    );
  if (move.to === null && move.from !== null)
    return (
      <>
        a quitté <AllianceLink tag={move.from} />
      </>
    );
  return (
    <>
      a quitté <AllianceLink tag={move.from ?? ""} /> pour <AllianceLink tag={move.to ?? ""} />
    </>
  );
}
