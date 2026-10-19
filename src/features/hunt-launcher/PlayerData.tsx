import type { HuntLevels } from "@/data/levels";
import { armyToKeys, UNITS } from "@/game/army/units";
import { probeArmy, type ProbePlan } from "@/game/probes";
import { formatNumber } from "@/utils/number-format";
import { NumberField } from "@/utils/NumberField";
import { unitsText } from "./view";

interface Props {
  /** Levels read on the game's pages. */
  read: HuntLevels;
  /** Levels the computation uses: those read, unless the player typed others. */
  levels: HuntLevels;
  onLevel: (level: keyof HuntLevels, value: number | null) => void;
  /** Factor of the queen's laying times, null when Reine.php could not be read. */
  layingSpeed: number | null;
  /** Units the game lets go hunting, by unit key. */
  available: Readonly<Record<string, number>>;
  reserve: Readonly<Record<string, number>>;
  /** How many of a unit go hunting: the rest is kept home. */
  onSend: (unit: string, count: number) => void;
  probes: ProbePlan;
}

const LEVELS: { key: keyof HuntLevels; label: string }[] = [
  { key: "weapons", label: "Armes" },
  { key: "shield", label: "Bouclier thoracique" },
  { key: "huntSpeed", label: "Vitesse de chasse" },
  { key: "cochineal", label: "Étable à cochenilles" },
];

/** « Vos données »: the levels and the army the hunts are computed with. */
export function PlayerData({ read, levels, onLevel, layingSpeed, available, reserve, onSend, probes }: Props) {
  const units = UNITS.filter((unit) => (available[unit.key] ?? 0) > 0);
  const edited = LEVELS.some(({ key }) => levels[key] !== read[key]);
  return (
    <div className="player-data">
      <div className="levels">
        <h3 className="optizzz-subtitle">Niveaux</h3>
        {LEVELS.map(({ key, label }) => (
          <label key={key} className="row">
            <span>{label}</span>
            <NumberField
              min={0}
              max={100}
              integer
              value={levels[key]}
              onCommit={(value) => {
                onLevel(key, value);
              }}
            />
          </label>
        ))}
        <p className="optizzz-note">
          {edited ? (
            <button
              type="button"
              className="optizzz-button-link"
              onClick={() => {
                for (const { key } of LEVELS) onLevel(key, null);
              }}
            >
              Revenir aux niveaux lus dans le jeu
            </button>
          ) : (
            "Lus sur le Laboratoire et Construction."
          )}{" "}
          {layingSpeed === null
            ? "Vitesse de ponte inconnue : passez par la Reine pour voir le temps de ponte des pertes."
            : "Vitesse de ponte (Couveuse, Solarium, Technique de ponte) lue sur la Reine."}
        </p>
      </div>

      <div className="army">
        <h3 className="optizzz-subtitle">Armée envoyée</h3>
        {units.length === 0 && <p className="optizzz-note">Aucune unité disponible.</p>}
        {units.map((unit) => {
          const max = available[unit.key] ?? 0;
          const sent = Math.max(0, max - (reserve[unit.key] ?? 0));
          return (
            <label key={unit.key} className="row">
              <span>{unit.name}</span>
              <NumberField
                min={0}
                max={max}
                integer
                amount
                className="units"
                value={sent}
                onCommit={(count) => {
                  onSend(unit.key, count ?? 0);
                }}
              />
              <button
                type="button"
                className="optizzz-button-link max"
                title="Envoyer toutes celles-ci"
                disabled={sent === max}
                onClick={() => {
                  onSend(unit.key, max);
                }}
              >
                ({formatNumber(max)} max)
              </button>
            </label>
          );
        })}
        <p className="optizzz-note">
          Le reste est gardé à la maison, et mémorisé pour les prochaines chasses.
          {Object.keys(probes).length > 0 &&
            ` Les sondes (${unitsText(armyToKeys(probeArmy(probes)))}) restent aussi, remises en place après le lancement.`}
        </p>
      </div>
    </div>
  );
}
