import type { ReactNode } from "react";

export interface MetricTab<M extends string> {
  id: M;
  label: string;
}

const PERIODS: { days: number | null; label: string }[] = [
  { days: 7, label: "7 j" },
  { days: 14, label: "14 j" },
  { days: 30, label: "30 j" },
  { days: null, label: "Tout" },
];

interface Props<M extends string> {
  metrics: readonly MetricTab<M>[];
  metric: M;
  days: number | null;
  onMetric: (metric: M) => void;
  onDays: (days: number | null) => void;
  /** More buttons between the tabs and the period (Total / Moyenne). */
  children?: ReactNode;
}

/** Score tabs and period buttons, shared by the history views. */
export function Controls<M extends string>({ metrics, metric, days, onMetric, onDays, children }: Props<M>) {
  return (
    <div className="optizzz-toolbar">
      <div className="optizzz-segmented" role="tablist">
        {metrics.map((m) => (
          <button key={m.id} role="tab" aria-selected={m.id === metric} onClick={() => onMetric(m.id)}>
            {m.label}
          </button>
        ))}
      </div>
      <div className="toolbar-end">
        {children}
        <div className="optizzz-segmented" role="group" aria-label="Période">
          {PERIODS.map((p) => (
            <button key={p.label} aria-pressed={p.days === days} onClick={() => onDays(p.days)}>
              {p.label}
            </button>
          ))}
        </div>
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
    <p className="optizzz-note">
      Chargement des exports : {loaded} / {total} (chacun n'est téléchargé qu'une fois)
      <progress value={loaded} max={total} />
    </p>
  );
}
