/** The browser's name for « Chrome, lié le 24 oct. » on the site: one of the site's list, never the full user agent. */
export function browserName(userAgent: string, isFirefox: boolean): string {
  if (isFirefox) return "Firefox";
  if (userAgent.includes("Edg/")) return "Edge";
  if (userAgent.includes("OPR/")) return "Opera";
  return "Chrome";
}
