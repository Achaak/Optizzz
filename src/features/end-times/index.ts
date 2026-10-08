import type { Feature } from "../feature";
import { isEnabled } from "../toggles";
import { annotateCountdowns } from "./countdowns";
import { mountRecap, RECAP_STYLE } from "./mount-recap";
import { kindsToRefresh, recapRows } from "./recap";
import { loadSections, refreshSections } from "@/data/end-times";

const WORDING_REFRESH_MS = 60_000;
const RECAP_REFRESH_MS = 30_000;

const STYLE = `
.optizzz-end-time { font-size: 0.9em; font-style: italic; white-space: nowrap; }
${RECAP_STYLE}`;

/**
 * End time next to the game's countdowns, and a « Prochaines fins » box in the left column.
 * See docs/features/end-times.md.
 */
export const endTimes: Feature = {
  id: "end-times",
  toggle: "end-times",
  matches: () => true,
  async run(ctx, toggles) {
    const loadedAt = new Date();
    const { origin } = new URL(location.href);

    // What the page lists is kept by the collect feature, the box being on or not.
    const style = document.createElement("style");
    style.textContent = STYLE;
    document.head.append(style);

    if (isEnabled(toggles, "end-times", "inline")) {
      const { update } = annotateCountdowns(document, loadedAt);
      ctx.setInterval(() => {
        update(new Date());
      }, WORDING_REFRESH_MS);
    }

    if (!isEnabled(toggles, "end-times", "recap")) return;
    const recap = mountRecap(document);
    if (!recap) return;
    let sections = await loadSections(origin);
    const draw = () => {
      const now = new Date();
      recap.render(recapRows(sections, now), now);
    };
    draw();
    ctx.setInterval(draw, RECAP_REFRESH_MS);

    const stale = kindsToRefresh(sections, loadedAt);
    if (stale.length > 0) {
      sections = await refreshSections(origin, stale);
      draw();
    }
  },
};
