import type { MapMember } from "./chart-option";
import type { Row, Trip } from "./neighbor-table";
import { formatDuration } from "./travel";

const numberFormat = new Intl.NumberFormat("fr-FR");

function TripTime({ trip }: { trip: Trip }) {
  return (
    <span
      className={trip.estimated ? "estimated" : undefined}
      title={`Vitesse d'attaque niveau ${trip.level}${trip.estimated ? " (niveau global, estimation)" : ""}`}
    >
      {formatDuration(trip.seconds)}
      {trip.estimated && "*"}
    </span>
  );
}

interface Props {
  selected: MapMember;
  rows: Row<MapMember>[];
  playerLevels: Record<string, number>;
  globalLevel: number;
  onSelect: (playerId: number) => void;
  onLevelChange: (playerId: number, level: number | null) => void;
}

export function NeighborTable({ selected, rows, playerLevels, globalLevel, onSelect, onLevelChange }: Props) {
  const levelInput = (member: MapMember) => (
    <input
      type="number"
      min={0}
      max={30}
      className="level"
      placeholder={String(globalLevel)}
      value={playerLevels[member.id] ?? ""}
      aria-label={`Vitesse d'attaque de ${member.pseudo}`}
      onChange={(e) => onLevelChange(member.id, e.target.value === "" ? null : Number(e.target.value))}
    />
  );

  return (
    <div className="neighbor-table">
      <p>
        Depuis <b>{selected.pseudo}</b> (Vit. att. {levelInput(selected)}) — <b>Aller</b> : de {selected.pseudo} vers le
        membre · <b>Retour</b> : du membre vers {selected.pseudo}.
      </p>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Pseudo</th>
            <th>Distance</th>
            <th>TDC</th>
            <th>Aller</th>
            <th>Retour</th>
            <th>Vit. att.</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.player.id} className={row.withinK ? "within-k" : undefined}>
              <td>{index + 1}</td>
              <td>
                <button type="button" className="link" onClick={() => onSelect(row.player.id)} title="Sélectionner">
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
      <p className="note">* temps estimé avec le niveau global (niveau du joueur inconnu).</p>
    </div>
  );
}
