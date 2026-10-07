import type { MapMember } from "./chart-option";
import type { Row, Trip } from "./neighbor-table";
import { formatDuration } from "./travel";

const numberFormat = new Intl.NumberFormat("fr-FR");

function TripTime({ trip }: { trip: Trip }) {
  return (
    <span
      className={trip.estimated ? "estimated" : undefined}
      title={`Calculé avec Vitesse d'attaque niveau ${trip.level}${trip.estimated ? " (niveau par défaut)" : ""}`}
    >
      {trip.estimated && "≈ "}
      {formatDuration(trip.seconds)}
    </span>
  );
}

interface Props {
  selected: MapMember;
  rows: Row<MapMember>[];
  playerLevels: Record<string, number>;
  defaultLevel: number;
  onSelect: (playerId: number) => void;
  onLevelChange: (playerId: number, level: number | null) => void;
}

export function NeighborTable({ selected, rows, playerLevels, defaultLevel, onSelect, onLevelChange }: Props) {
  const levelInput = (member: MapMember) => (
    <input
      type="number"
      min={0}
      max={30}
      className="level"
      placeholder={String(defaultLevel)}
      value={playerLevels[member.id] ?? ""}
      aria-label={`Vitesse d'attaque de ${member.pseudo}`}
      onChange={(e) => onLevelChange(member.id, e.target.value === "" ? null : Number(e.target.value))}
    />
  );

  return (
    <div className="neighbor-table">
      <p>
        Temps de trajet entre <b>{selected.pseudo}</b> et chaque membre. Un trajet (attaque ou convoi) dépend de la
        Vitesse d'attaque de <b>celui qui envoie</b>.
      </p>
      <p>
        Vitesse d'attaque ({selected.pseudo}) : {levelInput(selected)}
      </p>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Membre</th>
            <th>Distance</th>
            <th>TDC</th>
            <th title={`Envoyé par ${selected.pseudo}, avec sa Vitesse d'attaque`}>{selected.pseudo} → membre</th>
            <th title="Envoyé par le membre, avec sa Vitesse d'attaque">Membre → {selected.pseudo}</th>
            <th>Vitesse d'attaque du membre</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.player.id} className={row.withinK ? "within-k" : undefined}>
              <td>{index + 1}</td>
              <td>
                <button
                  type="button"
                  className="link"
                  onClick={() => onSelect(row.player.id)}
                  title="Afficher les trajets depuis ce membre"
                >
                  {row.player.masterPlayerId !== null && "⛓ "}
                  {row.player.pseudo}
                </button>{" "}
                <a href={`Membre.php?Pseudo=${encodeURIComponent(row.player.pseudo)}`} title="Voir le profil">
                  ↗
                </a>
                {row.player.onHoliday && <span className="holiday"> (vacances)</span>}
              </td>
              <td>{row.distance.toFixed(1)}</td>
              <td>{numberFormat.format(row.player.huntingField)}</td>
              <td>
                <TripTime trip={row.outbound} />
              </td>
              <td>
                <TripTime trip={row.inbound} />
              </td>
              <td>{levelInput(row.player)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="note">
        En gras : les membres reliés à {selected.pseudo} sur la carte. ≈ : Vitesse d'attaque inconnue, temps estimé avec
        le niveau par défaut ({defaultLevel}). Renseigne-la dans la dernière colonne pour un temps exact.
      </p>
    </div>
  );
}
