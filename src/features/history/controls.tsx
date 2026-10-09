import type { Metric } from "./series";

export const METRICS: { id: Metric; label: string }[] = [
  { id: "field", label: "TDC" },
  { id: "building", label: "Fourmilière" },
  { id: "technology", label: "Technologie" },
  { id: "trophy", label: "Combat" },
];

const PERIODS: { days: number | null; label: string }[] = [
  { days: 7, label: "7 j" },
  { days: 14, label: "14 j" },
  { days: 30, label: "30 j" },
  { days: null, label: "Tout" },
];

interface Props {
  metric: Metric;
  days: number | null;
  onMetric: (metric: Metric) => void;
  onDays: (days: number | null) => void;
}

/** Score tabs and period buttons, shared by the alliance view and the profile. */
export function Controls({ metric, days, onMetric, onDays }: Props) {
  return (
    <div className="toolbar">
      <div className="tabs" role="tablist">
        {METRICS.map((m) => (
          <button
            key={m.id}
            role="tab"
            aria-selected={m.id === metric}
            className={m.id === metric ? "active" : ""}
            onClick={() => onMetric(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>
      <div className="tabs">
        {PERIODS.map((p) => (
          <button key={p.label} className={p.days === days ? "active" : ""} onClick={() => onDays(p.days)}>
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}

interface LoadingProps {
  loaded: number;
  total: number;
  loading: boolean;
}

export function LoadingNote({ loaded, total, loading }: LoadingProps) {
  if (!loading || total === 0) return null;
  return (
    <p className="meta">
      Chargement des exports : {loaded} / {total} (chacun n'est téléchargé qu'une fois)
      <progress value={loaded} max={total} />
    </p>
  );
}
