import type { Feature } from "../feature";
import { isEnabled, loadToggles, type Toggles } from "../toggles";
import { COMPACT_STYLE, compactGameNumbers } from "./game-numbers";

/** For heavy content scripts and the extension's pages, before they draw: `formatAmount` follows the player's switch. */
export function applyCompactNumbers(toggles: Toggles) {
  setCompactNumbers(isEnabled(toggles, "compact-numbers", "extension"));
}

export async function loadCompactNumbers() {
  applyCompactNumbers(await loadToggles());
}

/** First in the registry: the other features draw their numbers with `formatAmount`. See docs/features/arrondis.md. */
export const compactNumbers: Feature = {
  id: "compact-numbers",
  toggle: "compact-numbers",
  matches: () => true,
  run(_ctx, toggles) {
    applyCompactNumbers(toggles);
  },
};

/** Last in the registry: the game's numbers are shortened once the other features have read the page. */
export const compactGamePages: Feature = {
  id: "compact-game-numbers",
  toggle: "compact-numbers",
  matches: () => true,
  run(ctx, toggles) {
    if (!isEnabled(toggles, "compact-numbers", "game")) return;
    const style = document.createElement("style");
    style.textContent = COMPACT_STYLE;
    document.head.append(style);
    const observers = compactGameNumbers(document, new URL(location.href));
    ctx.onInvalidated(() => {
      for (const observer of observers) observer.disconnect();
    });
  },
};
