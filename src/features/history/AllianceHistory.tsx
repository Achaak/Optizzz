import { useCallback, useEffect, useMemo, useState } from "react";
import { formatExportVersion } from "../alliance-map/dates";
import type { Scores } from "./api";
import type { Curve } from "./chart-option";
import { Controls, LoadingNote, METRICS } from "./controls";
import { formatGain, formatPercent } from "./format";
import { HistoryChart } from "./HistoryChart";
import { averageSeries, periodProgress, playerSeries, type Progress } from "./series";
import { readHistorySettings, writeHistorySettings, type HistorySettings } from "./settings";
import { useHistory } from "./useHistory";
import { formatNumber } from "@/utils/number-format";

interface Props {
  origin: string;
  loggedInPseudo: string | null;
  /** Read on the members table, by nickname. */
  liveScores: ReadonlyMap<string, Partial<Scores>>;
  liveTime: Date;
}

type SortKey = "pseudo" | "last" | "gain" | "percent";

interface Row {
  id: number;
  pseudo: string;
  progress: Progress | null;
}

const sortValue = (row: Row, key: SortKey): number | string =>
  key === "pseudo" ? row.pseudo.toLowerCase() : (row.progress?.[key] ?? -Infinity);

export function AllianceHistory({ origin, loggedInPseudo, liveScores, liveTime }: Props) {
  const host = new URL(origin).host;
  const [settings, setSettings] = useState<HistorySettings | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; descending: boolean }>({ key: "gain", descending: true });
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
  const arrow = (key: SortKey) => (sort.key === key ? (sort.descending ? " ▼" : " ▲") : "");

  if (error) return <div className="history error">Historique indisponible : {error}</div>;
  if (!settings || !playersExport) return <div className="history">Chargement de l'historique…</div>;
  if (!me?.alliance) return <div className="history">Vous n'êtes dans aucune alliance d'après le dernier export.</div>;

  const metricLabel = METRICS.find((m) => m.id === metric)?.label ?? "";
  const first = snapshots[0];

  return (
    <div className="history">
      <h2>Historique de progression — {me.alliance}</h2>
      <p className="meta">
        Un point par jour (l'export de minuit), puis un point creux « en direct » lu sur cette page
        {metric === "trophy" ? " (le Combat n'y figure pas : il s'arrête au dernier export)" : ""}.
        {first ? ` Depuis le ${formatExportVersion(first.version)}.` : ""}
      </p>
      <Controls
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

      <h3>Progression sur la période — {metricLabel}</h3>
      <p className="note">Cochez un membre pour afficher sa courbe.</p>
      <table className="progress">
        <thead>
          <tr>
            <th />
            <th className="sortable" onClick={() => sortBy("pseudo")}>
              Membre{arrow("pseudo")}
            </th>
            <th>Début</th>
            <th className="sortable num" onClick={() => sortBy("last")}>
              Maintenant{arrow("last")}
            </th>
            <th className="sortable num" onClick={() => sortBy("gain")}>
              Gain{arrow("gain")}
            </th>
            <th className="sortable num" onClick={() => sortBy("percent")}>
              %{arrow("percent")}
            </th>
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
              <td className="num">{row.progress ? formatNumber(row.progress.first) : "—"}</td>
              <td className="num">{row.progress ? formatNumber(row.progress.last) : "—"}</td>
              <td className={`num ${row.progress && row.progress.gain < 0 ? "down" : ""}`}>
                {row.progress ? formatGain(row.progress.gain) : "—"}
              </td>
              <td className="num">{row.progress ? formatPercent(row.progress.percent) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
