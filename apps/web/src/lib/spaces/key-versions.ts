// The highest version of each space's Clé d'alliance this device has seen (ADR 0005, « Une version cachée, et
// l'extension »): the site could hide the newest one from a member; a lower one served later is said, not used in
// silence. Storage can refuse (private browsing): the check is then skipped.
const PREFIX = "optizzz:key-version:";

export function seenKeyVersion(spaceId: string): number {
  try {
    return Number(localStorage.getItem(PREFIX + spaceId) ?? 0) || 0;
  } catch {
    return 0;
  }
}

/** Remembers `version` if higher than what was seen. */
export function noteKeyVersion(spaceId: string, version: number): void {
  if (version <= seenKeyVersion(spaceId)) return;
  try {
    localStorage.setItem(PREFIX + spaceId, String(version));
  } catch {
    // Refused: the check is skipped.
  }
}
