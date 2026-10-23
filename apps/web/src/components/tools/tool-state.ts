// Which state a tool opens with: a shared link (`#p=`), else the browser's last state, else empty. A link that cannot
// be read opens the tool empty with a note. See docs/features/site-outils.md.
import { readLinkState, type LinkFormat } from "@optizzz/game/site-links/link-state";

export interface OpeningState<State> {
  state: State;
  /** Opened from a link (shared, or from the extension): « Mes niveaux » are left untouched. */
  fromLink: boolean;
  /** The address held a link that could not be read (cut, hand-edited, unknown version). */
  invalidLink: boolean;
}

/**
 * `stored` is the browser's last state of the tool, as its links write it. The fragment the tool wrote itself (the
 * page reloaded, or back in the history) is that same text: it is not a link, and « Mes niveaux » keep following
 * what is typed.
 */
export function openingState<State>(
  address: URL,
  stored: string | null,
  format: LinkFormat<State>,
  empty: State,
): OpeningState<State> {
  const request = readLinkState(address, format);
  if (request.kind === "state") {
    const own = new URLSearchParams(address.hash.slice(1)).get("p") === stored;
    return { state: request.state, fromLink: !own, invalidLink: false };
  }
  if (request.kind === "invalid") return { state: empty, fromLink: false, invalidLink: true };
  return { state: (stored ? format.decode(stored) : null) ?? empty, fromLink: false, invalidLink: false };
}
