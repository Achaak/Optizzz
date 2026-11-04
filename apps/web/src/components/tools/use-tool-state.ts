"use client";

// A tool's state, in the fragment of its address (to share it, never sent to the site) and in the browser (to come
// back to it). The page is rendered on the server without state: the state is read once in the browser.
// See docs/features/site-outils.md.
import { linkFragment, type LinkFormat } from "@optizzz/game/site-links/link-state";
import { siteToolPath, type SiteToolId } from "@optizzz/game/site-links/site";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { readStorage, writeStorage } from "./browser-storage";
import { MY_LEVELS_KEY, parseMyLevels, type MyLevels } from "./my-levels";
import { openingState, type OpeningState } from "./tool-state";

const storageKey = (tool: SiteToolId) => `optizzz:tool:${tool}`;

/** Links pasted in the tab: only the fragment changes, without a reload. The tool opens again on each. */
let pastedLinks = 0;
function subscribePastedLinks(onPaste: () => void) {
  const listener = () => {
    pastedLinks += 1;
    onPaste();
  };
  window.addEventListener("hashchange", listener);
  return () => {
    window.removeEventListener("hashchange", listener);
  };
}

export interface ToolStateOptions<State> {
  tool: SiteToolId;
  format: LinkFormat<State>;
  /** A tool opened without anything to reuse, and after a link that cannot be read. Read at opening only. */
  empty: State;
  /** Opened without a link: its level fields take « Mes niveaux » (`pickLevels`). Read at opening only. */
  withMyLevels?: (state: State, mine: MyLevels) => State;
}

export interface ToolState<State> extends OpeningState<State> {
  /** False until the state is read in the browser: the server renders the empty state. */
  ready: boolean;
  /** Changes at each opening (a link pasted in the tab opens the tool again): for `useMyLevels`. */
  opening: number;
  /** Each change is written to the address and to the browser. */
  change: (update: (current: State) => State) => void;
}

/** `changed`: the visitor changed something since the opening. */
type Opened<State> = OpeningState<State> & { opening: number; changed: boolean };

export function useToolState<State>({ tool, format, empty, withMyLevels }: ToolStateOptions<State>): ToolState<State> {
  // Read at opening only: a tool may pass them inline.
  const [atOpening] = useState(() => ({ empty, withMyLevels }));
  // -1 on the server and while hydrating: the address and the browser's storage are read after. -1 also while the
  // address is not yet the tool's: followed from a `Link`, the page renders before Next writes its address (and its
  // fragment); `useSyncExternalStore` reads it again once committed.
  const opening = useSyncExternalStore(
    subscribePastedLinks,
    () => (window.location.pathname === siteToolPath(tool) ? pastedLinks : -1),
    () => -1,
  );
  const [opened, setOpened] = useState<Opened<State> | null>(null);

  // A new opening adjusts the state while rendering (no effect: no render of the stale state first).
  let current = opened;
  if (opening >= 0 && opened?.opening !== opening) {
    const read = openingState(new URL(window.location.href), readStorage(storageKey(tool)), format, atOpening.empty);
    const state =
      atOpening.withMyLevels && !read.fromLink
        ? atOpening.withMyLevels(read.state, parseMyLevels(readStorage(MY_LEVELS_KEY)))
        : read.state;
    current = { ...read, state, opening, changed: false };
    setOpened(current);
  }

  // Each change goes to the fragment (replaceState: no history entry per keystroke) and to the browser. A link, read or
  // not, leaves the browser's last state alone until the visitor changes something: reloaded, it is still a link.
  useEffect(() => {
    if (!opened) return;
    const encoded = format.encode(opened.state);
    window.history.replaceState(null, "", `${siteToolPath(tool)}${linkFragment(encoded)}`);
    if (opened.changed || !(opened.fromLink || opened.invalidLink)) writeStorage(storageKey(tool), encoded);
  }, [opened, tool, format]);

  const change = useCallback((update: (state: State) => State) => {
    setOpened((now) => now && { ...now, state: update(now.state), invalidLink: false, changed: true });
  }, []);

  return current
    ? {
        state: current.state,
        fromLink: current.fromLink,
        invalidLink: current.invalidLink,
        ready: true,
        opening: current.opening,
        change,
      }
    : { state: atOpening.empty, fromLink: false, invalidLink: false, ready: false, opening: -1, change };
}
