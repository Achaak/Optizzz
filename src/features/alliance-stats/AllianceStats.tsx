import { useCallback, useEffect, useMemo, useState } from "react";
import { loadPlayersExport, type PlayersExport } from "@/data/exports";
import type { Scores } from "@/features/history/api";
import { WAR_LABELS } from "@/game/diplomacy";
import type { AllianceRanking } from "@/game/pages/alliance-ranking";
import type { Curve } from "@/utils/history-chart/chart-option";
import { Controls, LoadingNote } from "@/utils/history-chart/controls";
import { formatGain, formatPercent } from "@/utils/history-chart/format";
import { HistoryChart } from "@/utils/history-chart/HistoryChart";
import { periodProgress, type Progress } from "@/utils/history-chart/progress";
import { formatExportVersion } from "@/utils/export-date";
import { dayMonth } from "@/utils/time-format";
import { formatDecimal, formatNumber } from "@/utils/number-format";
import { useStoredSettings } from "@/utils/useStoredSettings";
import { AverageToggle, formatRankChange, formatValue } from "./common";
import { ViewSwitch } from "@/utils/history-chart/ViewSwitch";
import { ALLIANCE_METRICS, metricLabel } from "./metrics";
import {
  allianceSeries,
  findAlliance,
  membersTotals,
  rankOf,
  shares,
  valueOf,
  suggestions,
  type AllianceMetric,
  type LiveAlliance,
  type Suggestion,
} from "./series";
import { ProductionSection } from "./ProductionSection";
import { readAllianceStatsSettings, writeAllianceStatsSettings } from "./settings";
import { useAllianceHistory } from "./useAllianceHistory";

interface Props {
  origin: string;
  /** From the page header; null outside an alliance. */
  myTag: string | null;
  loggedInPseudo: string | null;
  /** From the page header. */
  myWorkers: number | null;
  /** Read on the members table, by nickname. */
  members: ReadonlyMap<string, Partial<Scores>>;
  liveTime: Date;
  /** My alliance's page; undefined while it is read, null when it could not be. */
  ranking: AllianceRanking | null | undefined;
  /** Whether the members' view (« Progression ») is on, for the switch between the views. */
  membersView: boolean;
}

type SortKey = "tag" | "first" | "last" | "gain" | "percent" | "rank";

interface Row {
  tag: string;
  name: string;
  mine: boolean;
  progress: Progress | null;
  rank: number | null;
  /** Places gained over the period; null when unknown. */
  rankChange: number | null;
  /** Epoch ms of the first point of the period. */
  since: number | null;
}

const sortValue = (row: Row, key: SortKey): number | string => {
  if (key === "tag") return row.tag.toLowerCase();
  // The best rank is the smallest: sorted like the others, « descending » puts it first.
  if (key === "rank") return row.rank === null ? -Infinity : -row.rank;
  return row.progress?.[key] ?? -Infinity;
};

const reasonOf = (suggestion: Suggestion) =>
  suggestion.reason === "war"
    ? WAR_LABELS[suggestion.declaredBy].toLowerCase()
    : suggestion.reason === "pact"
      ? "pacte"
      : "voisine";

const sameTag = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** The game ranks the production with the TDC it comes from. */
const gameRankOf = (ranking: AllianceRanking | null | undefined, metric: AllianceMetric) =>
  ranking?.ranks[metric === "production" ? "field" : metric];

export function AllianceStats({
  origin,
  myTag,
  loggedInPseudo,
  myWorkers,
  members,
  liveTime,
  ranking,
  membersView,
}: Props) {
  const host = new URL(origin).host;
  const [settings, updateSettings] = useStoredSettings(host, readAllianceStatsSettings, writeAllianceStatsSettings);
  const [sort, setSort] = useState<{ key: SortKey; descending: boolean }>({ key: "gain", descending: true });
  const [search, setSearch] = useState("");
  const [searchError, setSearchError] = useState<string | null>(null);
  const { alliancesExport, snapshots, total, loading, error } = useAllianceHistory(origin, settings?.days);

  const metric = settings?.metric ?? "field";
  const average = (settings?.average ?? false) && metric !== "members";
  const latest = snapshots.at(-1);

  // For the trophies (not on the members table) and the colonies of the production.
  const [playersExport, setPlayersExport] = useState<PlayersExport | null>(null);
  useEffect(() => {
    loadPlayersExport(origin).then(setPlayersExport, (e: unknown) => {
      console.warn("[Optizzz] alliance stats: players export unavailable", e);
    });
  }, [origin]);

  const live = useMemo<LiveAlliance | undefined>(() => {
    if (ranking) return { time: liveTime, scores: ranking.scores };
    if (ranking === null && members.size > 0) return { time: liveTime, scores: membersTotals(members) };
    return undefined;
  }, [ranking, members, liveTime]);

  const compared = useMemo(
    () => (settings?.compared ?? []).filter((tag) => !myTag || !sameTag(tag, myTag)),
    [settings?.compared, myTag],
  );
  const nameOf = useCallback(
    (tag: string) =>
      alliancesExport?.alliances.find((alliance) => sameTag(alliance.tag, tag))?.name ??
      (myTag && sameTag(tag, myTag) ? ranking?.name : undefined) ??
      tag,
    [alliancesExport, myTag, ranking],
  );

  const seriesOf = useCallback(
    (tag: string) => allianceSeries(snapshots, tag, metric, average, myTag && sameTag(tag, myTag) ? live : undefined),
    [snapshots, metric, average, myTag, live],
  );

  const curves = useMemo<Curve[]>(
    () =>
      [...(myTag ? [myTag] : []), ...compared].map((tag) => ({
        name: tag,
        points: seriesOf(tag),
        highlight: myTag !== null && sameTag(tag, myTag),
      })),
    [myTag, compared, seriesOf],
  );

  const rows = useMemo<Row[]>(() => {
    const unsorted = [...(myTag ? [myTag] : []), ...compared].map((tag) => {
      const mine = myTag !== null && sameTag(tag, myTag);
      const gameRank = mine && !average ? gameRankOf(ranking, metric) : undefined;
      const rank = gameRank ?? (latest ? rankOf(latest.alliances, tag, metric, average) : null);
      const first = snapshots.find((snapshot) => findAlliance(snapshot.alliances, tag));
      const firstRank = first ? rankOf(first.alliances, tag, metric, average) : null;
      const points = seriesOf(tag);
      return {
        tag,
        name: nameOf(tag),
        mine,
        since: points[0]?.time ?? null,
        progress: periodProgress(points),
        rank,
        rankChange: rank !== null && firstRank !== null ? firstRank - rank : null,
      };
    });
    const direction = sort.descending ? -1 : 1;
    return unsorted.sort((a, b) => {
      const [x, y] = [sortValue(a, sort.key), sortValue(b, sort.key)];
      return x < y ? -direction : x > y ? direction : 0;
    });
  }, [myTag, compared, average, ranking, metric, latest, snapshots, seriesOf, sort, nameOf]);

  const suggested = useMemo(
    () =>
      myTag && alliancesExport && latest
        ? suggestions(alliancesExport.alliances, latest, myTag, metric).filter(
            (s) => !compared.some((tag) => sameTag(tag, s.tag)),
          )
        : [],
    [myTag, alliancesExport, latest, metric, compared],
  );

  const distribution = useMemo(() => {
    if (metric === "members") return [];
    const values = new Map<string, number>();
    if (metric === "trophy") {
      for (const player of playersExport?.players ?? []) {
        if (myTag && player.alliance !== null && sameTag(player.alliance, myTag))
          values.set(player.pseudo, player.trophyScore);
      }
    } else {
      for (const [pseudo, scores] of members) {
        const value = valueOf(scores, metric, false);
        if (value !== undefined) values.set(pseudo, value);
      }
    }
    return shares(values);
  }, [metric, members, playersExport, myTag]);

  const compare = (tag: string) =>
    updateSettings((current) =>
      current.compared.some((other) => sameTag(other, tag))
        ? current
        : { ...current, compared: [...current.compared, tag] },
    );
  const remove = (tag: string) =>
    updateSettings((current) => ({ ...current, compared: current.compared.filter((other) => !sameTag(other, tag)) }));
  const addSearched = () => {
    const wanted = search.trim();
    const found = alliancesExport?.alliances.find(
      (alliance) => sameTag(alliance.tag, wanted) || alliance.name.toLowerCase() === wanted.toLowerCase(),
    );
    if (!found) {
      setSearchError(wanted ? `Aucune alliance « ${wanted} » dans le dernier export.` : null);
      return;
    }
    setSearchError(null);
    compare(found.tag);
    setSearch("");
  };

  const sortBy = (key: SortKey) =>
    setSort((current) => ({ key, descending: current.key === key ? !current.descending : key !== "tag" }));
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
    return <div className="history optizzz-panel optizzz-panel--danger">Statistiques indisponibles : {error}</div>;
  if (!myTag) return <div className="history optizzz-panel">Vous n'êtes dans aucune alliance.</div>;
  if (!settings) return <div className="history optizzz-panel">Chargement des statistiques…</div>;

  const latestMine = latest && findAlliance(latest.alliances, myTag);
  const inExport = snapshots.some((snapshot) => findAlliance(snapshot.alliances, myTag));
  const firstShown = snapshots.find((snapshot) => findAlliance(snapshot.alliances, myTag));

  const setMetric = (next: AllianceMetric) => updateSettings((current) => ({ ...current, metric: next }));

  return (
    <div className="history optizzz-panel">
      <h2 className="optizzz-panel-title">Statistiques de l'alliance {myTag}</h2>
      <ViewSwitch current="alliance" otherOn={membersView} />

      <h3 className="optizzz-subtitle">Maintenant</h3>
      {ranking === undefined && <p className="optizzz-note">Lecture de la page de l'alliance…</p>}
      {ranking === null && (
        <p className="optizzz-note">
          La page de l'alliance ne répond pas : totaux du tableau Membres (sans le Combat) et rangs au dernier export.
        </p>
      )}
      <div className="optizzz-stats" role="tablist">
        {ALLIANCE_METRICS.map(({ id, label }) => {
          const liveValue = live && valueOf(live.scores, id, false);
          const exported = latestMine && valueOf(latestMine, id, false);
          const now = liveValue ?? exported;
          const delta = liveValue !== undefined && exported !== undefined ? liveValue - exported : null;
          const gameRank = gameRankOf(ranking, id);
          const rank = gameRank ?? (latest ? rankOf(latest.alliances, myTag, id, false) : null);
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={id === metric}
              className="optizzz-stat"
              onClick={() => setMetric(id)}
            >
              <span className="optizzz-stat-label">{label}</span>
              <span className="optizzz-stat-value">{now === undefined ? "—" : formatNumber(now)}</span>
              {delta !== null && delta !== 0 && (
                <span className={`optizzz-stat-note ${delta < 0 ? "down" : ""}`}>{formatGain(delta)}</span>
              )}
              {rank !== null && (
                <span
                  className="optizzz-stat-note"
                  title={gameRank === undefined ? "Rang au dernier export" : "Rang du jeu"}
                >
                  {rank}
                  <sup>e</sup>
                  {gameRank === undefined ? " (export)" : ""}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {latest && latestMine && (
        <p className="optizzz-note">Écarts depuis l'export du {formatExportVersion(latest.version)}.</p>
      )}

      <h3 className="optizzz-subtitle">Dans le temps</h3>
      <p className="optizzz-note">
        Un point par jour (l'export des alliances de minuit), puis un point creux « en direct » pour votre alliance.
        {firstShown ? ` Depuis le ${formatExportVersion(firstShown.version)}.` : ""}
      </p>
      {!loading && !inExport && <p className="optizzz-note">Pas encore dans l'export public.</p>}
      <Controls
        metrics={ALLIANCE_METRICS}
        metric={metric}
        days={settings.days}
        onMetric={setMetric}
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
      <HistoryChart curves={curves} />

      <form
        className="compare"
        onSubmit={(event) => {
          event.preventDefault();
          addSearched();
        }}
      >
        <label htmlFor="optizzz-compare">Comparer avec</label>
        <input
          id="optizzz-compare"
          list="optizzz-alliances"
          placeholder="Tag ou nom d'une alliance"
          value={search}
          onChange={(event) => {
            setSearch(event.currentTarget.value);
            setSearchError(null);
          }}
        />
        <datalist id="optizzz-alliances">
          {alliancesExport?.alliances.map((alliance) => (
            <option key={alliance.tag} value={alliance.tag}>
              {alliance.name}
            </option>
          ))}
        </datalist>
        <button type="submit">Ajouter</button>
      </form>
      {searchError && <p className="optizzz-callout optizzz-callout--danger">{searchError}</p>}
      {suggested.length > 0 && (
        <p className="optizzz-chips">
          {suggested.map((s) => (
            <button
              key={s.tag}
              type="button"
              className="optizzz-chip"
              onClick={() => compare(s.tag)}
              title={nameOf(s.tag)}
            >
              + {s.tag} <span className="optizzz-muted">({reasonOf(s)})</span>
            </button>
          ))}
        </p>
      )}

      <div className="optizzz-scroll">
        <table className="optizzz-table progress">
          <thead>
            <tr>
              {sortHeader("tag", "Alliance", false)}
              {sortHeader("first", "Début")}
              {sortHeader("last", "Maintenant")}
              {sortHeader("gain", "Gain")}
              {sortHeader("percent", "%")}
              {sortHeader("rank", "Rang")}
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.tag} className={row.mine ? "me" : ""}>
                <td>
                  <a href={`classementAlliance.php?alliance=${encodeURIComponent(row.tag)}`} title={row.name}>
                    {row.tag}
                  </a>
                </td>
                <td
                  className="optizzz-num"
                  title={row.since === null ? undefined : `Le ${dayMonth(new Date(row.since))}`}
                >
                  {row.progress ? formatValue(row.progress.first) : "—"}
                </td>
                <td className="optizzz-num">{row.progress ? formatValue(row.progress.last) : "—"}</td>
                <td className={`optizzz-num ${row.progress && row.progress.gain < 0 ? "down" : ""}`}>
                  {row.progress ? formatGain(Math.round(row.progress.gain)) : "—"}
                </td>
                <td className="optizzz-num">{row.progress ? formatPercent(row.progress.percent) : "—"}</td>
                <td className="optizzz-num">
                  {row.rank ?? "—"}
                  {row.rankChange !== null && row.rankChange !== 0 && (
                    <span
                      className={row.rankChange < 0 ? "down" : "up"}
                      title={rankChangeTitle(row.rankChange, row.since)}
                    >
                      {" "}
                      {formatRankChange(row.rankChange)}
                    </span>
                  )}
                </td>
                <td>
                  {!row.mine && (
                    <button
                      type="button"
                      className="optizzz-button-link"
                      aria-label={`Retirer ${row.tag}`}
                      onClick={() => remove(row.tag)}
                    >
                      ✕
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {distribution.length > 0 && (
        <>
          <h3 className="optizzz-subtitle">Répartition — {metricLabel(metric)}</h3>
          {metric === "trophy" && (
            <p className="optizzz-note">D'après le dernier export : le tableau Membres n'a pas le Combat.</p>
          )}
          <ul className="bars">
            {distribution.map((share) => (
              <li key={share.pseudo} className={share.pseudo === loggedInPseudo ? "me" : ""}>
                <a href={`Membre.php?Pseudo=${encodeURIComponent(share.pseudo)}`}>{share.pseudo}</a>
                <span className="optizzz-bar">
                  <span style={{ width: `${String(share.share ?? 0)}%` }} />
                </span>
                <span className="optizzz-num">{formatNumber(share.value)}</span>
                <span className="optizzz-num">{share.share === null ? "—" : `${formatDecimal(share.share)} %`}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <ProductionSection
        origin={origin}
        myTag={myTag}
        loggedInPseudo={loggedInPseudo}
        myWorkers={myWorkers}
        members={members}
        playersExport={playersExport}
      />
    </div>
  );
}

/** « 7 places perdues depuis le 06/10 ». */
function rankChangeTitle(change: number, since: number | null): string {
  const places = Math.abs(change);
  const text = `${String(places)} place${places > 1 ? "s" : ""} ${change > 0 ? "gagnée" : "perdue"}${places > 1 ? "s" : ""}`;
  return since === null ? text : `${text} depuis le ${dayMonth(new Date(since))}`;
}
