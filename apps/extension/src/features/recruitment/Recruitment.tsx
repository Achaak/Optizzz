// The « Recrutement » view: players without alliance to recruit, the fastest growth first. See
// docs/features/recrutement.md. Nothing is sent: the pseudo leads to the profile, where the player writes.
import { useEffect, useMemo, useState } from "react";
import { loadPlayersExport, type PlayersExport } from "@/data/exports";
import { inactivityOf, loadRecentNights, INACTIVITY_DAYS } from "@/data/nights";
import type { Snapshot } from "@/features/history/api";
import { recruits, type Recruit } from "@optizzz/game/analysis/recruits";
import { formatAmount, formatDecimal } from "@optizzz/game/format/number-format";
import { NumberField } from "@/utils/NumberField";
import { useStoredSettings } from "@/utils/useStoredSettings";
import { readRecruitFilters, writeRecruitFilters } from "./settings";

interface Props {
  origin: string;
  /** Mine, from the page header. */
  myTag: string;
}

type SortKey = "gain" | "field" | "distance" | "pseudo";

const PAGE_SIZE = 50;

const gainText = (gain: number | null) =>
  gain === null ? "—" : `${gain > 0 ? "▲ +" : gain < 0 ? "▼ −" : ""}${formatDecimal(Math.abs(gain) * 100)} %`;

const sortValue = (row: Recruit, key: SortKey): number | string =>
  key === "pseudo" ? row.pseudo.toLowerCase() : key === "gain" ? (row.gain ?? -Infinity) : (row[key] ?? Infinity);

export function Recruitment({ origin, myTag }: Props) {
  const host = new URL(origin).host;
  const [filters, updateFilters] = useStoredSettings(host, readRecruitFilters, writeRecruitFilters);
  const [players, setPlayers] = useState<PlayersExport | null>(null);
  const [nights, setNights] = useState<Snapshot[] | null>(null);
  const [error, setError] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; descending: boolean }>({ key: "gain", descending: true });
  const [shown, setShown] = useState(PAGE_SIZE);

  useEffect(() => {
    loadPlayersExport(origin).then(setPlayers, (e: unknown) => {
      console.warn("[Optizzz] recruitment: players export unavailable", e);
      setError(true);
    });
    loadRecentNights(origin).then(setNights, (e: unknown) => {
      console.warn("[Optizzz] recruitment: nightly exports unavailable", e);
      setNights([]);
    });
  }, [origin]);

  const result = useMemo(() => {
    if (!players || !nights || !filters) return null;
    // 7 nights before the last one, when no night is missing.
    const first = nights.length === INACTIVITY_DAYS ? nights[0] : undefined;
    const weekAgo = new Map([...(first?.players ?? [])].map(([id, scores]) => [id, scores.field]));
    const inactive = new Set(
      players.players.filter((player) => inactivityOf(nights, player.id)).map((player) => player.id),
    );
    return recruits({ players: players.players, tag: myTag, weekAgo, inactive, filters });
  }, [players, nights, filters, myTag]);

  const rows = useMemo(() => {
    if (!result) return [];
    if (sort.key === "gain" && sort.descending) return result.rows;
    const direction = sort.descending ? -1 : 1;
    return [...result.rows].sort((a, b) => {
      const [x, y] = [sortValue(a, sort.key), sortValue(b, sort.key)];
      return x < y ? -direction : x > y ? direction : 0;
    });
  }, [result, sort]);

  if (error)
    return (
      <div className="optizzz-panel optizzz-panel--danger">
        L'export public de Fourmizzz ne répond pas : recrutement indisponible.
      </div>
    );
  if (!result || !filters) return <div className="optizzz-panel">Chargement des joueurs à recruter…</div>;

  const sortBy = (key: SortKey) => {
    setSort((current) => ({
      key,
      descending: current.key === key ? !current.descending : key !== "pseudo" && key !== "distance",
    }));
    setShown(PAGE_SIZE);
  };
  const header = (key: SortKey, label: string, numeric = true) => (
    <th
      className={numeric ? "optizzz-num" : undefined}
      aria-sort={sort.key === key ? (sort.descending ? "descending" : "ascending") : undefined}
    >
      <button type="button" className="optizzz-sort" onClick={() => sortBy(key)}>
        {label}
        {sort.key === key ? (sort.descending ? " ▼" : " ▲") : ""}
      </button>
    </th>
  );
  const field = (label: string, value: number | null, onCommit: (value: number | null) => void) => (
    <label className="recruitment-filter">
      {label}
      <NumberField value={value} onCommit={onCommit} min={0} integer allowEmpty amount placeholder="aucun" />
    </label>
  );

  return (
    <div className="optizzz-panel recruitment">
      <h2 className="optizzz-panel-title">Joueurs à recruter pour {myTag}</h2>
      <p className="optizzz-note">
        Sans alliance, ni en vacances, ni bannis, ni inactifs probables · {formatAmount(result.rows.length)} joueurs
        {result.center
          ? ` · centre de l'alliance : x ${formatDecimal(result.center.x)}, y ${formatDecimal(result.center.y)} (la médiane des positions des membres)`
          : ""}
        .
      </p>
      <div className="optizzz-toolbar">
        {field("TDC minimum", filters.minField, (minField) => {
          updateFilters((current) => ({ ...current, minField }));
          setShown(PAGE_SIZE);
        })}
        {field("TDC maximum", filters.maxField, (maxField) => {
          updateFilters((current) => ({ ...current, maxField }));
          setShown(PAGE_SIZE);
        })}
        {field("Distance maximum (cases)", filters.maxDistance, (maxDistance) => {
          updateFilters((current) => ({ ...current, maxDistance }));
          setShown(PAGE_SIZE);
        })}
      </div>
      {rows.length === 0 ? (
        <p className="optizzz-note">Personne ne correspond à ces filtres.</p>
      ) : (
        <div className="optizzz-scroll">
          <table className="optizzz-table">
            <thead>
              <tr>
                {header("pseudo", "Pseudo", false)}
                {header("field", "TDC")}
                {header("gain", "Gain 7 j")}
                {header("distance", "Distance")}
                <th>Colonisé par</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, shown).map((row) => (
                <tr key={row.id}>
                  <td>
                    <a href={`Membre.php?Pseudo=${encodeURIComponent(row.pseudo)}`}>{row.pseudo}</a>
                  </td>
                  <td className="optizzz-num">{formatAmount(row.field)}</td>
                  <td className="optizzz-num">{gainText(row.gain)}</td>
                  <td className="optizzz-num">{row.distance === null ? "—" : formatDecimal(row.distance)}</td>
                  <td>
                    {row.master
                      ? `${row.master.pseudo}${row.master.alliance ? ` (${row.master.alliance})` : " (sans alliance)"}`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {rows.length > shown && (
        <button type="button" className="optizzz-button-link" onClick={() => setShown((count) => count + PAGE_SIZE)}>
          Voir plus ({formatAmount(rows.length - shown)} restants)
        </button>
      )}
      <p className="optizzz-note">
        Rien n'est envoyé : le pseudo mène au profil, où vous écrivez vous-même. Gain d'après l'export de minuit il y a
        7 jours.
      </p>
    </div>
  );
}
