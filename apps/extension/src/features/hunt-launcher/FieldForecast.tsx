import { NumberField } from "@/utils/NumberField";
import type { Settings } from "./settings";

interface Props {
  forecast: Settings["fieldForecast"];
  onChange: (forecast: Settings["fieldForecast"]) => void;
  /** The player typed the arrival field: the forecast no longer counts until they come back to it. */
  hidden: boolean;
  onApply: () => void;
}

/**
 * « Prévision de TdC »: a change of field the player expects before the hunts fight (flood sent to other hunters,
 * received…), remembered and added to the arrival field on every launch while it is ticked. Shown in both views, so
 * the value in use is in sight at every launch.
 */
export function FieldForecast({ forecast, onChange, hidden, onApply }: Props) {
  return (
    <div className="field-forecast">
      <label
        className="auto"
        title="Mémorisée : elle s'ajoute au TdC à l'arrivée à chaque lancement, tant que la case est cochée."
      >
        <input
          type="checkbox"
          checked={forecast.enabled}
          onChange={(e) => {
            onChange({ ...forecast, enabled: e.target.checked });
          }}
        />
        Prévision de TdC
      </label>
      <NumberField
        amount
        integer
        signed
        className="wide"
        aria-label="Variation de TdC attendue avant l'arrivée des chasses, en cm²"
        value={forecast.change}
        onCommit={(change) => {
          // Typing a change means using it; clearing it to 0 leaves the box as it was.
          if (change !== null) onChange({ enabled: change !== 0 || forecast.enabled, change });
        }}
      />
      {forecast.enabled && hidden ? (
        <span>
          <strong>⚠ ignorée</strong> : TdC à l'arrivée tapé à la main.{" "}
          <button type="button" className="optizzz-button-link" onClick={onApply}>
            L'appliquer
          </button>
        </span>
      ) : (
        <span className="optizzz-muted">cm² d'ici l'arrivée : − pour un flood envoyé, + pour un flood reçu</span>
      )}
    </div>
  );
}
