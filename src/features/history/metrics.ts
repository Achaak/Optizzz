import type { MetricTab } from "@/utils/history-chart/controls";
import type { Metric } from "./series";

export const METRICS: MetricTab<Metric>[] = [
  { id: "field", label: "TDC" },
  { id: "building", label: "Fourmilière" },
  { id: "technology", label: "Technologie" },
  { id: "trophy", label: "Combat" },
];
