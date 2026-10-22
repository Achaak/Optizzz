import { useMemo, useState } from "react";
import type { Player } from "@optizzz/game/exports";
import { formatDecimal } from "@optizzz/game/format/number-format";
import { Amount } from "@/utils/Amount";
import { formatDuration } from "@optizzz/game/format/time-format";
import { sortRows, type SortKey, type TableRow } from "./view";

interface Props {
  rows: TableRow[];
  reference: Player;
  profileUrl: (player: Player) => string;
  /** Where profile links open: the game tab around the dialog, or a new tab. */
  linkTarget: "_top" | "_blank";
  onFocus: (playerId: number | null) => void;
  onZoom: (player: Player) => void;
  onReference: (player: Player) => void;
  /** Back to measuring from me; absent when I am the reference. */
  onReferenceMe?: () => void;
}

/** `optional`: left out on a narrow screen (a phone), where the table would scroll sideways. */
const COLUMNS: { key: SortKey | null; label: string; title?: string; num?: boolean; optional?: boolean }[] = [
  { key: "pseudo", label: "Joueur" },
  { key: "alliance", label: "Alliance" },
  { key: null, label: "Coordonnées", num: true, optional: true },
  { key: "distance", label: "Distance", num: true },
  {
    key: "distance",
    label: "Trajet",
    title: "Envoyé par le joueur de référence, avec sa Vitesse d'attaque",
    num: true,
  },
  { key: "field", label: "TDC", title: "TDC de l'export public", num: true },
  { key: null, label: "État", optional: true },
  { key: null, label: "" },
];

function state(player: Player): string {
  return [player.onHoliday && "vacances", player.masterPlayerId !== null && "colonisé"].filter(Boolean).join(", ");
}

export function PlayerTable(props: Props) {
  const { rows, reference, profileUrl, linkTarget, onFocus, onZoom, onReference, onReferenceMe } = props;
  /** The column clicked (Distance and Trajet sort alike, only the clicked one shows the arrow). */
  const [sort, setSort] = useState<{ column: number; key: SortKey; descending: boolean }>({
    column: 3,
    key: "distance",
    descending: false,
  });
  const sorted = useMemo(() => sortRows(rows, sort.key, sort.descending), [rows, sort]);

  if (rows.length === 0) {
    return <p className="optizzz-note">Ajoutez des joueurs ou des alliances pour les voir ici, triés par distance.</p>;
  }

  return (
    <div className="player-table">
      <p className="optizzz-note">
        <Amount value={rows.length} /> joueur{rows.length > 1 ? "s" : ""}, trajets depuis <b>{reference.pseudo}</b>
        {onReferenceMe ? (
          <>
            {" · "}
            <button type="button" className="optizzz-button-link" onClick={onReferenceMe}>
              depuis vous
            </button>
          </>
        ) : (
          " (choisissez un joueur pour mesurer depuis lui)"
        )}
      </p>
      <div className="optizzz-scroll">
        <table className="optizzz-table">
          <thead>
            <tr>
              {COLUMNS.map(({ key, label, title, num, optional }, index) => (
                <th
                  key={index}
                  title={title}
                  className={[num && "optizzz-num", optional && "optional"].filter(Boolean).join(" ") || undefined}
                  aria-sort={sort.column === index ? (sort.descending ? "descending" : "ascending") : undefined}
                >
                  {key ? (
                    <button
                      type="button"
                      className="optizzz-sort"
                      onClick={() => {
                        setSort((current) => ({
                          column: index,
                          key,
                          descending: current.column === index ? !current.descending : key === "field",
                        }));
                      }}
                    >
                      {label}
                    </button>
                  ) : (
                    label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map(({ player, chip, distance, trip }) => (
              <tr key={player.id} onMouseEnter={() => onFocus(player.id)} onMouseLeave={() => onFocus(null)}>
                <td>
                  <button
                    type="button"
                    className="optizzz-button-link"
                    title="Mesurer les distances depuis ce joueur"
                    onClick={() => onReference(player)}
                  >
                    {player.pseudo}
                  </button>{" "}
                  <a href={profileUrl(player)} target={linkTarget} title="Voir le profil">
                    ↗
                  </a>
                </td>
                <td>
                  <span className="dot" style={{ background: chip.color }} aria-hidden="true" />
                  {player.alliance ?? "—"}
                </td>
                <td className="optizzz-num optional">
                  {player.x} ; {player.y}
                </td>
                <td className="optizzz-num">{formatDecimal(distance)}</td>
                <td
                  className={trip.estimated ? "optizzz-num estimated" : "optizzz-num"}
                  title={`Vitesse d'attaque niveau ${String(trip.level)}${trip.estimated ? " (niveau par défaut)" : ""}`}
                >
                  {trip.estimated && "≈ "}
                  {formatDuration(trip.seconds * 1000)}
                </td>
                <td className="optizzz-num">
                  <Amount value={player.field} />
                </td>
                <td className="optional">{state(player)}</td>
                <td>
                  <button
                    type="button"
                    className="icon"
                    title="Zoomer sur ce joueur"
                    aria-label={`Zoomer sur ${player.pseudo}`}
                    onClick={() => onZoom(player)}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      aria-hidden="true"
                    >
                      <circle cx="11" cy="11" r="7" />
                      <line x1="16.5" y1="16.5" x2="21" y2="21" />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.some((row) => row.trip.estimated) && (
        <p className="optizzz-note">
          ≈ : Vitesse d'attaque de {reference.pseudo} inconnue, trajet estimé avec la vôtre (ou le niveau par défaut de
          la Carte de l'alliance).
        </p>
      )}
    </div>
  );
}
