import type { MapMember } from "./chart-option";
import { levelOf, type KnownLevels, type Row, type Trip } from "./neighbor-table";
import { formatDecimal, formatNumber } from "@/utils/number-format";
import { NumberField } from "@/utils/NumberField";
import { formatDuration } from "@/utils/time-format";

function TripTime({ trip }: { trip: Trip }) {
  return (
    <span
      className={trip.estimated ? "estimated" : undefined}
      title={`Calculé avec Vitesse d'attaque niveau ${trip.level}${trip.estimated ? " (niveau par défaut)" : ""}`}
    >
      {trip.estimated && "≈ "}
      {formatDuration(trip.seconds * 1000)}
    </span>
  );
}

interface Props {
  selected: MapMember;
  rows: Row<MapMember>[];
  playerLevels: Record<string, number>;
  defaultLevel: number;
  levels: KnownLevels;
  onSelect: (playerId: number) => void;
  onLevelChange: (playerId: number, level: number | null) => void;
}

export function NeighborTable({ selected, rows, playerLevels, defaultLevel, levels, onSelect, onLevelChange }: Props) {
  // Empty field: the level actually used is shown (mine from the Laboratory, the default for the others).
  const levelInput = (member: MapMember) => (
    <NumberField
      min={0}
      max={30}
      integer
      allowEmpty
      className="level"
      placeholder={String(levelOf(member.id, levels).level)}
      value={playerLevels[member.id] ?? null}
      aria-label={`Vitesse d'attaque de ${member.pseudo}`}
      onCommit={(level) => {
        onLevelChange(member.id, level);
      }}
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
              <td>{formatDecimal(row.distance)}</td>
              <td>{formatNumber(row.player.huntingField)}</td>
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
        le niveau par défaut ({defaultLevel}). Renseignez-la dans la dernière colonne pour un temps exact.
      </p>
    </div>
  );
}
