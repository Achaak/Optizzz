// The « Suivis » view: the watched players and alliances, what changed since « seen » — see docs/features/suivis.md.
import { useEffect, useMemo, useState } from "react";
import { versionDate } from "@optizzz/game/export-versions";
import { loadAlliancesExport, loadPlayersExport, type AlliancesExport, type PlayersExport } from "@/data/exports";
import { loadStoredLevels } from "@/data/levels";
import {
  addToWatchlist,
  loadWatchlist,
  markSeen,
  removeFromWatchlist,
  WATCH_LIMIT,
  watchWatchlist,
  type Seen,
  type WatchEntry,
  type WatchKey,
} from "@/data/watchlist";
import { sameTag } from "@optizzz/game/diplomacy";
import { formatAmount, formatDecimal } from "@optizzz/game/format/number-format";
import { Amount } from "@/utils/Amount";
import { formatDuration, formatPastTime } from "@optizzz/game/format/time-format";
import type { JournalEntry } from "./changes";
import { describeChange } from "@optizzz/game/changes";
import { describeWhen } from "./describe";
import { loadJournal, loadMe, loadWatchState, watchReadings } from "./reading";
import { buildRows, type AllianceRow, type PlayerRow } from "./rows";

interface Props {
  origin: string;
}

const EXPORT_ERROR = "l'export public de Fourmizzz ne répond pas. Réessayez dans quelques minutes.";

/** What the latest reading stored, read again after each one. */
function useReadings(host: string) {
  const [journal, setJournal] = useState<JournalEntry[]>([]);
  const [lastReading, setLastReading] = useState<string | null>(null);
  useEffect(() => {
    const load = () => {
      void loadJournal(host).then(setJournal);
      void loadWatchState(host).then((state) => {
        setLastReading(state?.version ?? null);
      });
    };
    load();
    return watchReadings(host, load);
  }, [host]);
  return { journal, lastReading };
}

const signed = (value: number) =>
  value > 0 ? `+${formatAmount(value)}` : value < 0 ? `−${formatAmount(-value)}` : "0";

function Gap({ gap }: { gap: PlayerRow["gap"] }) {
  if (!gap) return <>—</>;
  const text = `${signed(gap.delta)} (${gap.percent > 0 ? "+" : gap.percent < 0 ? "−" : ""}${formatDecimal(Math.abs(gap.percent))} %)`;
  return gap.notable ? <b>{text}</b> : <span className="optizzz-muted">{text}</span>;
}

function Changes({ changes, now }: { changes: JournalEntry[]; now: Date }) {
  if (changes.length === 0) return null;
  return (
    <ul className="changes">
      {changes.map((noted, i) => (
        <li key={`${noted.until}-${String(i)}`}>
          {describeChange(noted.change)} <span className="optizzz-muted">· {describeWhen(noted, now)}</span>
        </li>
      ))}
    </ul>
  );
}

function Actions({
  row,
  onSeen,
  onRemove,
}: {
  row: PlayerRow | AllianceRow;
  onSeen: () => void;
  onRemove: () => void;
}) {
  return (
    <td className="actions">
      {row.isNew && (
        <button type="button" onClick={onSeen}>
          Vu
        </button>
      )}
      <button type="button" className="optizzz-button-link" onClick={onRemove}>
        Retirer
      </button>
    </td>
  );
}

export function Watchlist({ origin }: Props) {
  const host = new URL(origin).host;
  const [entries, setEntries] = useState<WatchEntry[] | null>(null);
  const [playersExport, setPlayersExport] = useState<PlayersExport | null>(null);
  const [alliancesExport, setAlliancesExport] = useState<AlliancesExport | null>(null);
  const [me, setMe] = useState<string | null>(null);
  const [attackSpeed, setAttackSpeed] = useState<number | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<{ text: string; danger: boolean; undo?: () => void } | null>(null);
  const { journal, lastReading } = useReadings(host);
  const now = new Date();

  useEffect(() => {
    void loadWatchlist(host).then(setEntries);
    return watchWatchlist(host, setEntries);
  }, [host]);

  useEffect(() => {
    loadPlayersExport(origin).then(setPlayersExport, (e: unknown) => {
      console.error("[Optizzz] watch list: players export unavailable", e);
      setError(EXPORT_ERROR);
    });
    loadAlliancesExport(origin).then(setAlliancesExport, (e: unknown) => {
      console.warn("[Optizzz] watch list: alliances export unavailable", e);
    });
    void loadMe(host).then(setMe);
    void loadStoredLevels(origin).then((levels) => {
      setAttackSpeed(levels.attackSpeed);
    });
  }, [origin, host]);

  const rows = useMemo(
    () =>
      entries && playersExport
        ? buildRows({
            entries,
            journal,
            players: playersExport.players,
            alliances: alliancesExport?.alliances ?? null,
            me,
            attackSpeed,
          })
        : null,
    [entries, journal, playersExport, alliancesExport, me, attackSpeed],
  );

  /** Pseudos and tags starting with what is typed: the whole server would be 20 000 options on S2. */
  const suggestions = useMemo(() => {
    const typed = query.trim().toLowerCase();
    if (typed.length < 2 || !playersExport) return [];
    const players = playersExport.players
      .filter((player) => player.pseudo.toLowerCase().startsWith(typed))
      .slice(0, 15)
      .map((player) => ({ value: player.pseudo, label: player.alliance ? `[${player.alliance}]` : "Sans alliance" }));
    const alliances = (alliancesExport?.alliances ?? [])
      .filter((alliance) => alliance.tag.toLowerCase().startsWith(typed.replace(/^\[/, "")))
      .slice(0, 5)
      .map((alliance) => ({ value: `[${alliance.tag}]`, label: `Alliance ${alliance.name}` }));
    return [...alliances, ...players];
  }, [query, playersExport, alliancesExport]);

  if (error) return <p className="optizzz-callout optizzz-callout--danger">Suivis indisponibles : {error}</p>;
  if (!entries || !playersExport || !rows) return <p className="optizzz-note">Chargement des suivis…</p>;

  const version = playersExport.version;
  const seenNow = (row: PlayerRow | AllianceRow): Seen => ({ version, field: row.field ?? 0 });

  const add = (event: { preventDefault: () => void }) => {
    event.preventDefault();
    const typed = query.trim();
    const tag = /^\[(.+)\]$/.exec(typed)?.[1];
    const alliance = alliancesExport?.alliances.find((candidate) => sameTag(candidate.tag, tag ?? typed));
    const player = tag
      ? undefined
      : playersExport.players.find((candidate) => candidate.pseudo.toLowerCase() === typed.toLowerCase());
    const entry: WatchEntry | null = player
      ? { kind: "player", id: player.id, pseudo: player.pseudo, seen: { version, field: player.field } }
      : alliance
        ? { kind: "alliance", tag: alliance.tag, seen: { version, field: alliance.totalField } }
        : null;
    if (!entry) {
      setMessage({ text: `Aucun joueur ni alliance « ${typed} » dans l'export.`, danger: true });
      return;
    }
    const name = entry.kind === "player" ? entry.pseudo : entry.tag;
    void addToWatchlist(host, entry).then((result) => {
      setMessage(
        result === "added"
          ? { text: `Ajouté à vos suivis : ${name}.`, danger: false }
          : result === "already"
            ? { text: `Déjà dans vos suivis : ${name}.`, danger: false }
            : { text: `Limite de ${String(WATCH_LIMIT)} suivis atteinte : retirez-en un d'abord.`, danger: true },
      );
      if (result === "added") setQuery("");
    });
  };

  const seenAll = () => {
    const marks: Partial<Record<WatchKey, Seen>> = {};
    for (const row of [...rows.players, ...rows.alliances]) if (row.isNew) marks[row.key] = seenNow(row);
    void markSeen(host, marks);
  };
  const newCount = [...rows.players, ...rows.alliances].filter((row) => row.isNew).length;

  /** Removes at once, with a way back: the entry comes back with its « seen » mark. */
  const remove = (row: PlayerRow | AllianceRow) => {
    const name = row.kind === "player" ? row.pseudo : row.tag;
    void removeFromWatchlist(host, row.key).then(() => {
      setMessage({
        text: `Retiré de vos suivis : ${name}.`,
        danger: false,
        undo: () => {
          void addToWatchlist(host, row.entry).then(() => {
            setMessage(null);
          });
        },
      });
    });
  };

  return (
    <div className="watchlist optizzz-panel">
      <h2 className="optizzz-panel-title optizzz-panel-title--large">
        Suivis · {(host.split(".")[0] ?? host).toUpperCase()}
      </h2>
      <form className="optizzz-toolbar" onSubmit={add}>
        <label className="add">
          Suivre{" "}
          <input
            list="optizzz-watch-suggestions"
            value={query}
            placeholder="Pseudo, ou [TAG] d'une alliance"
            onChange={(event) => {
              setQuery(event.target.value);
              setMessage(null);
            }}
          />
        </label>
        <datalist id="optizzz-watch-suggestions">
          {suggestions.map((suggestion) => (
            <option key={suggestion.value} value={suggestion.value}>
              {suggestion.label}
            </option>
          ))}
        </datalist>
        <button type="submit" disabled={!query.trim()}>
          Ajouter
        </button>
        <span className="toolbar-end">
          {newCount > 0 && (
            <button type="button" onClick={seenAll}>
              Tout marquer comme vu ({newCount})
            </button>
          )}
        </span>
      </form>
      {message && (
        <p className={`optizzz-callout ${message.danger ? "optizzz-callout--warning" : "optizzz-callout--success"}`}>
          {message.text}
          {message.undo && (
            <>
              {" "}
              <button type="button" className="optizzz-button-link" onClick={message.undo}>
                Annuler
              </button>
            </>
          )}
        </p>
      )}

      {entries.length === 0 ? (
        <p className="optizzz-note">
          Aucun suivi sur ce serveur. Ajoutez un joueur ou une alliance ci-dessus, ou avec « Suivre » sur son profil ou
          la page de l'alliance.
        </p>
      ) : (
        <>
          <p className="optizzz-note">
            {lastReading
              ? `Dernier relevé : ${formatPastTime(versionDate(lastReading), now)}. Relevé chaque heure, même le jeu fermé, tant que le navigateur est ouvert.`
              : "Premier relevé dans un instant : les changements s'afficheront à partir du suivant."}
          </p>
          {rows.players.length > 0 && (
            <section>
              <h3 className="optizzz-subtitle">Joueurs ({rows.players.length})</h3>
              <div className="optizzz-scroll">
                <table className="optizzz-table optizzz-table--dense optizzz-table--striped">
                  <thead>
                    <tr>
                      <th>Joueur</th>
                      <th>Alliance</th>
                      <th className="optizzz-num">TDC</th>
                      <th className="optizzz-num">Depuis « vu »</th>
                      <th className="optizzz-num">Distance</th>
                      <th className="optizzz-num">Trajet</th>
                      <th>Nouveau</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.players.map((row) => (
                      <tr key={row.key} className={row.isNew ? "is-new" : undefined}>
                        <td>
                          <a href={`${origin}/Membre.php?Pseudo=${encodeURIComponent(row.pseudo)}`} target="_top">
                            {row.pseudo}
                          </a>
                          {row.formerPseudo && <span className="optizzz-muted"> (ex-{row.formerPseudo})</span>}
                          {row.gone && <span className="optizzz-text-danger"> · n'existe plus</span>}
                          {row.isBanned && <span className="optizzz-text-danger"> · compte banni</span>}
                          {row.onHoliday && <span className="optizzz-muted"> · en vacances</span>}
                        </td>
                        <td>{row.alliance ?? <span className="optizzz-muted">—</span>}</td>
                        <td className="optizzz-num">{row.field === null ? "—" : <Amount value={row.field} />}</td>
                        <td className="optizzz-num">
                          <Gap gap={row.gap} />
                        </td>
                        <td className="optizzz-num">{row.distance === null ? "—" : formatDecimal(row.distance)}</td>
                        <td className="optizzz-num">
                          {row.travelSeconds === null ? "—" : formatDuration(row.travelSeconds * 1000)}
                        </td>
                        <td>
                          <Changes changes={row.changes} now={now} />
                        </td>
                        <Actions
                          row={row}
                          onSeen={() => void markSeen(host, { [row.key]: seenNow(row) })}
                          onRemove={() => {
                            remove(row);
                          }}
                        />
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
          {rows.alliances.length > 0 && (
            <section>
              <h3 className="optizzz-subtitle">Alliances ({rows.alliances.length})</h3>
              <div className="optizzz-scroll">
                <table className="optizzz-table optizzz-table--dense optizzz-table--striped">
                  <thead>
                    <tr>
                      <th>Alliance</th>
                      <th className="optizzz-num">Membres</th>
                      <th className="optizzz-num">TDC total</th>
                      <th className="optizzz-num">Depuis « vu »</th>
                      <th>Nouveau</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.alliances.map((row) => (
                      <tr key={row.key} className={row.isNew ? "is-new" : undefined}>
                        <td>
                          <a
                            href={`${origin}/classementAlliance.php?alliance=${encodeURIComponent(row.tag)}`}
                            target="_top"
                          >
                            {row.tag}
                          </a>
                          {row.gone && <span className="optizzz-text-danger"> · n'existe plus</span>}
                        </td>
                        <td className="optizzz-num">{row.members === null ? "—" : <Amount value={row.members} />}</td>
                        <td className="optizzz-num">{row.field === null ? "—" : <Amount value={row.field} />}</td>
                        <td className="optizzz-num">
                          <Gap gap={row.gap} />
                        </td>
                        <td>
                          <Changes changes={row.changes} now={now} />
                        </td>
                        <Actions
                          row={row}
                          onSeen={() => void markSeen(host, { [row.key]: seenNow(row) })}
                          onRemove={() => {
                            remove(row);
                          }}
                        />
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
