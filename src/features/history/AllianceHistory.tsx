import { useCallback, useMemo, useState } from "react";
import { formatExportVersion } from "@/utils/export-date";
import type { Scores } from "./api";
import type { Curve } from "@/utils/history-chart/chart-option";
import { Controls, LoadingNote } from "@/utils/history-chart/controls";
import { METRICS } from "./metrics";
import { formatGain, formatPercent } from "@/utils/history-chart/format";
import { HistoryChart } from "@/utils/history-chart/HistoryChart";
import { averageSeries, periodProgress, playerSeries, type Progress } from "./series";
import { readHistorySettings, writeHistorySettings } from "./settings";
import { useHistory } from "./useHistory";
import { formatAmount } from "@/utils/number-format";
import { useStoredSettings } from "@/utils/useStoredSettings";
import { ViewSwitch } from "@/utils/history-chart/ViewSwitch";

interface Props {
  origin: string;
  loggedInPseudo: string | null;
  /** Read on the members table, by nickname. */
  liveScores: ReadonlyMap<string, Partial<Scores>>;
  liveTime: Date;
  /** Whether the alliance's view (« Statistiques ») is on, for the switch between the views. */
  allianceView: boolean;
}

type SortKey = "pseudo" | "first" | "last" | "gain" | "percent";

interface Row {
  id: number;
  pseudo: string;
  progress: Progress | null;
}

const sortValue = (row: Row, key: SortKey): number | string =>
  key === "pseudo" ? row.pseudo.toLowerCase() : (row.progress?.[key] ?? -Infinity);

export function AllianceHistory({ origin, loggedInPseudo, liveScores, liveTime, allianceView }: Props) {
  const host = new URL(origin).host;
  const [settings, updateSettings] = useStoredSettings(host, readHistorySettings, writeHistorySettings);
  const [sort, setSort] = useState<{ key: SortKey; descending: boolean }>({ key: "gain", descending: true });
  const { playersExport, snapshots, total, loading, error } = useHistory(origin, settings?.days);

  const me = playersExport?.players.find((p) => p.pseudo === loggedInPseudo) ?? null;
  const allianceTag = me?.alliance ?? null;
  const members = useMemo(
    () => (allianceTag ? (playersExport?.players.filter((p) => p.alliance === allianceTag) ?? []) : []),
    [playersExport, allianceTag],
  );
  const live = useMemo(() => {
    const scores = new Map<number, Partial<Scores>>();
    for (const member of members) {
      const memberScores = liveScores.get(member.pseudo);
      if (memberScores) scores.set(member.id, memberScores);
    }
    return { time: liveTime, scores };
  }, [members, liveScores, liveTime]);

  const memberIds = useMemo(() => new Set(members.map((m) => m.id)), [members]);
  const selected = useMemo(() => {
    const kept = settings?.selected.filter((id) => memberIds.has(id)) ?? [];
    return kept.length > 0 || !me ? kept : [me.id];
  }, [settings?.selected, memberIds, me]);

  const metric = settings?.metric ?? "field";
  const seriesOf = useCallback(
    (id: number) => {
      const scores = live.scores.get(id);
      return playerSeries(snapshots, id, metric, scores && { time: live.time, scores });
    },
    [snapshots, metric, live],
  );

  const curves = useMemo<Curve[]>(() => {
    const players = selected.flatMap((id) => {
      const member = members.find((m) => m.id === id);
      return member ? [{ name: member.pseudo, points: seriesOf(id), highlight: id === me?.id }] : [];
    });
    if (!settings?.showAverage) return players;
    const average = averageSeries(snapshots, [...memberIds], metric, live);
    return [...players, { name: "Moyenne de l'alliance", points: average, dashed: true }];
  }, [selected, members, seriesOf, me?.id, settings?.showAverage, snapshots, memberIds, metric, live]);

  const rows = useMemo<Row[]>(() => {
    const unsorted = members.map((m) => ({ id: m.id, pseudo: m.pseudo, progress: periodProgress(seriesOf(m.id)) }));
    const direction = sort.descending ? -1 : 1;
    return unsorted.sort((a, b) => {
      const [x, y] = [sortValue(a, sort.key), sortValue(b, sort.key)];
      return x < y ? -direction : x > y ? direction : 0;
    });
  }, [members, seriesOf, sort]);

  const toggle = (id: number) =>
    updateSettings((current) => ({
      ...current,
      selected: selected.includes(id) ? selected.filter((other) => other !== id) : [...selected, id],
    }));

  const sortBy = (key: SortKey) =>
    setSort((current) => ({ key, descending: current.key === key ? !current.descending : key !== "pseudo" }));
  const sortHeader = (key: SortKey, label: string, numeric = true) => (
    <th
      className={numeric ? "optizzz-num" : undefined}
      aria-sort={sort.key === key ? (sort.descending ? "descending" : "ascending") : undefined}
    >
      <button type="button" className="optizzz-sort" onClick={() => sortBy(key)}>
        {label}
      </button>
    </th>
  );

  if (error)
    return <div className="history optizzz-panel optizzz-panel--danger">Historique indisponible : {error}</div>;
  // The period starts where the curves shown start, not at the first export (a member may join later).
  const shownIds = settings?.showAverage ? [...memberIds] : selected;
  const firstShown = snapshots.find((snapshot) => shownIds.some((id) => snapshot.players.has(id)));
  if (!settings || !playersExport) return <div className="history optizzz-panel">Chargement de l'historique…</div>;
  if (!me?.alliance)
    return <div className="history optizzz-panel">Vous n'êtes dans aucune alliance d'après le dernier export.</div>;

  const metricLabel = METRICS.find((m) => m.id === metric)?.label ?? "";

  return (
    <div className="history optizzz-panel">
      <h2 className="optizzz-panel-title">Progression des membres de {me.alliance}</h2>
      <ViewSwitch current="members" otherOn={allianceView} />
      <p className="optizzz-note">
        Un point par jour (l'export de minuit), puis un point creux « en direct » lu sur cette page
        {metric === "trophy" ? " (le Combat n'y figure pas : il s'arrête au dernier export)" : ""}.
        {firstShown ? ` Depuis le ${formatExportVersion(firstShown.version)}.` : ""}
      </p>
      <Controls
        metrics={METRICS}
        metric={metric}
        days={settings.days}
        onMetric={(next) => updateSettings((current) => ({ ...current, metric: next }))}
        onDays={(next) => updateSettings((current) => ({ ...current, days: next }))}
      />
      <LoadingNote loaded={snapshots.length} total={total} loading={loading} />
      <HistoryChart curves={curves} />
      <label className="average">
        <input
          type="checkbox"
          checked={settings.showAverage}
          onChange={(event) => {
            const showAverage = event.currentTarget.checked;
            updateSettings((current) => ({ ...current, showAverage }));
          }}
        />
        Moyenne de l'alliance
      </label>

      <h3 className="optizzz-subtitle">Progression sur la période — {metricLabel}</h3>
      <p className="optizzz-note">Cochez un membre pour afficher sa courbe.</p>
      <table className="optizzz-table progress">
        <thead>
          <tr>
            <th />
            {sortHeader("pseudo", "Membre", false)}
            {sortHeader("first", "Début")}
            {/* The members table has no trophies: the last value is the last export's. */}
            {sortHeader("last", metric === "trophy" ? "Dernier export" : "Maintenant")}
            {sortHeader("gain", "Gain")}
            {sortHeader("percent", "%")}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className={row.id === me.id ? "me" : ""}>
              <td>
                <input
                  type="checkbox"
                  aria-label={`Courbe de ${row.pseudo}`}
                  checked={selected.includes(row.id)}
                  onChange={() => toggle(row.id)}
                />
              </td>
              <td>
                <a href={`Membre.php?Pseudo=${encodeURIComponent(row.pseudo)}`}>{row.pseudo}</a>
              </td>
              <td className="optizzz-num">{row.progress ? formatAmount(row.progress.first) : "—"}</td>
              <td className="optizzz-num">{row.progress ? formatAmount(row.progress.last) : "—"}</td>
              <td className={`optizzz-num ${row.progress && row.progress.gain < 0 ? "down" : ""}`}>
                {row.progress ? formatGain(row.progress.gain) : "—"}
              </td>
              <td className="optizzz-num">{row.progress ? formatPercent(row.progress.percent) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
