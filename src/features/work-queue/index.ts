import type { Feature } from "../feature";
import { mountWorkQueue } from "./mount";

const REFRESH_MS = 15_000;

// Close to the game's own tables: thin dark borders, bold headers, inherited font and colours.
const STYLE = `
.optizzz-work-queue { margin: var(--optizzz-space-4) 0 var(--optizzz-space-6); }
.optizzz-work-queue tfoot td { border: none; padding-top: var(--optizzz-space-3); font-weight: normal; font-size: var(--optizzz-font-size-small); color: var(--optizzz-text-muted); }
.optizzz-work-queue tfoot td:empty { display: none; }
.optizzz-work-queue td:nth-child(3) { white-space: nowrap; }
.optizzz-work-queue-bar {
  display: inline-block; vertical-align: middle; width: 80px; height: var(--optizzz-space-4); margin-right: var(--optizzz-space-3);
  border: 1px solid var(--optizzz-table-border); border-radius: var(--optizzz-radius-pill);
  background: linear-gradient(to right, var(--optizzz-action) var(--progress, 0%), transparent 0);
}
/* Phone: « Fin » says when, the remaining time goes, so that « Annuler » stays on screen. */
@media screen and (max-width: 41em) {
  .optizzz-work-queue th:nth-child(4), .optizzz-work-queue td:nth-child(4) { display: none; }
  .optizzz-work-queue :is(th, td) { padding: var(--optizzz-space-1) var(--optizzz-space-2); }
  .optizzz-work-queue-bar { width: 40px; margin-right: var(--optizzz-space-2); }
}`;

/** Table of the buildings / research in progress, on construction.php and laboratoire.php. */
export const workQueue: Feature = {
  id: "work-queue",
  toggle: "work-queue",
  matches: (url) => /^\/(construction|laboratoire)\.php$/i.test(url.pathname),
  run(ctx) {
    if (document.querySelector(".optizzz-work-queue")) return;
    const style = document.createElement("style");
    style.textContent = STYLE;
    document.head.append(style);

    const { update } = mountWorkQueue(document, new Date());
    ctx.setInterval(() => {
      update(new Date());
    }, REFRESH_MS);
  },
};
