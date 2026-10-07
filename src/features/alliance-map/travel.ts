/**
 * Travel time (attack or convoy) in seconds for a given distance,
 * depending on the sender's Attack Speed ("Vitesse d'attaque") research level.
 * Formula taken from Toolzzz — see docs/research/temps-de-trajet.md.
 */
export function travelTime(distance: number, attackSpeedLevel: number): number {
  return Math.ceil(0.9 ** attackSpeedLevel * 637200 * (1 - Math.exp(-distance / 350)));
}

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
