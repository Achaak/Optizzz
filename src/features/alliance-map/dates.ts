const parisFormat = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

/** "202610062200" (UTC) → "07/10 à 00h00" (Paris time). */
export function formatExportVersion(version: string): string {
  const [year, month, day, hour, minute] = [
    version.slice(0, 4),
    version.slice(4, 6),
    version.slice(6, 8),
    version.slice(8, 10),
    version.slice(10, 12),
  ].map(Number) as [number, number, number, number, number];
  const parts = Object.fromEntries(
    parisFormat
      .formatToParts(new Date(Date.UTC(year, month - 1, day, hour, minute)))
      .map((part) => [part.type, part.value]),
  );
  return `${parts.day}/${parts.month} à ${parts.hour}h${parts.minute}`;
}
