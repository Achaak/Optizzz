import { formatDateTime } from "@/utils/time-format";

/** "202610062200": a UTC date. */
export function exportVersionDate(version: string): Date {
  const [year, month, day, hour, minute] = [
    version.slice(0, 4),
    version.slice(4, 6),
    version.slice(6, 8),
    version.slice(8, 10),
    version.slice(10, 12),
  ].map(Number) as [number, number, number, number, number];
  return new Date(Date.UTC(year, month - 1, day, hour, minute));
}

/** "202610062200" (UTC) → "07/10 à 0 h 00" (Paris time, as every time Optizzz shows). */
export function formatExportVersion(version: string): string {
  return formatDateTime(exportVersionDate(version));
}
