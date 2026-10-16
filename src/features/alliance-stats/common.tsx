import { formatDecimal, formatNumber } from "@/utils/number-format";

/** A total as the game writes it, an average per member with one decimal. */
export const formatValue = (value: number) => (Number.isInteger(value) ? formatNumber(value) : formatDecimal(value));

/** « ▲2 » for places gained, « ▼1 » for places lost. */
export const formatRankChange = (change: number) => `${change > 0 ? "▲" : "▼"}${String(Math.abs(change))}`;

interface AverageProps {
  checked: boolean;
  onChange: (average: boolean) => void;
}

/** Total / Moyenne par membre. */
export function AverageToggle({ checked, onChange }: AverageProps) {
  return (
    <div className="tabs average-toggle">
      <button type="button" className={checked ? "" : "active"} onClick={() => onChange(false)}>
        Total
      </button>
      <button type="button" className={checked ? "active" : ""} onClick={() => onChange(true)}>
        Moyenne par membre
      </button>
    </div>
  );
}
