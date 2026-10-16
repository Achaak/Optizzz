import type { Feature } from "../feature";
import { mountWorkQueue } from "./mount";

const REFRESH_MS = 15_000;

// Close to the game's own tables: thin dark borders, bold headers, inherited font and colours.
const STYLE = `
.optizzz-work-queue { width: 100%; border-collapse: collapse; margin: 8px 0 16px; }
.optizzz-work-queue th, .optizzz-work-queue td { border: 1px solid var(--optizzz-table-border); padding: 3px 8px; text-align: left; }
.optizzz-work-queue tfoot td { border: none; padding-top: 6px; font-style: italic; }
.optizzz-work-queue tfoot td:empty { display: none; }
.optizzz-work-queue td:nth-child(3) { white-space: nowrap; }
.optizzz-work-queue-bar {
  display: inline-block; vertical-align: middle; width: 80px; height: 8px; margin-right: 6px;
  border: 1px solid var(--optizzz-table-border);
  background: linear-gradient(to right, var(--optizzz-action) var(--progress, 0%), transparent 0);
}
/* Phone: « Fin » says when, the remaining time goes, so that « Annuler » stays on screen. */
@media screen and (max-width: 41em) {
  .optizzz-work-queue th:nth-child(4), .optizzz-work-queue td:nth-child(4) { display: none; }
  .optizzz-work-queue th, .optizzz-work-queue td { padding: 3px 4px; }
  .optizzz-work-queue-bar { width: 40px; margin-right: 4px; }
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
