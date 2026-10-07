const twoDigits = (n: number) => String(n).padStart(2, "0");

export function formatDuration(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}j`);
  if (d > 0 || h > 0) parts.push(`${h}h`);
  parts.push(`${parts.length ? twoDigits(m) : m}m`, `${twoDigits(s)}s`);
  return parts.join(" ");
}
