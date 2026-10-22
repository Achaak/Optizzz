import type { MetricTab } from "@/utils/history-chart/controls";
import type { AllianceMetric } from "./series";

export const ALLIANCE_METRICS: MetricTab<AllianceMetric>[] = [
  { id: "field", label: "TDC" },
  { id: "production", label: "Production" },
  { id: "building", label: "Fourmilière" },
  { id: "technology", label: "Technologie" },
  { id: "trophy", label: "Combat" },
  { id: "members", label: "Membres" },
];

export const metricLabel = (metric: AllianceMetric) => ALLIANCE_METRICS.find((m) => m.id === metric)?.label ?? "";
