import { Amount } from "@/utils/Amount";
import { formatDecimal } from "@optizzz/game/format/number-format";

/** A total as the game writes it, an average per member with one decimal. */
export const formatValue = (value: number) =>
  Number.isInteger(value) ? <Amount value={value} /> : formatDecimal(value);

/** « ▲2 » for places gained, « ▼1 » for places lost. */
export const formatRankChange = (change: number) => `${change > 0 ? "▲" : "▼"}${String(Math.abs(change))}`;

interface AverageProps {
  checked: boolean;
  onChange: (average: boolean) => void;
}

/** Total / Moyenne par membre. */
export function AverageToggle({ checked, onChange }: AverageProps) {
  return (
    <div className="optizzz-segmented average-toggle" role="group">
      <button type="button" aria-pressed={!checked} onClick={() => onChange(false)}>
        Total
      </button>
      <button type="button" aria-pressed={checked} onClick={() => onChange(true)}>
        Moyenne par membre
      </button>
    </div>
  );
}
