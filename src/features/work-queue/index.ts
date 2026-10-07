import type { Feature } from "../feature";
import { mountWorkQueue } from "./mount";

const REFRESH_MS = 15_000;

// Close to the game's own tables: thin dark borders, bold headers, inherited font and colours.
const STYLE = `
.optizzz-work-queue { width: 100%; border-collapse: collapse; margin: 8px 0 16px; }
.optizzz-work-queue th, .optizzz-work-queue td { border: 1px solid #000; padding: 3px 8px; text-align: left; }
.optizzz-work-queue tfoot td { border: none; padding-top: 6px; font-style: italic; }
.optizzz-work-queue tfoot td:empty { display: none; }
.optizzz-work-queue td:nth-child(3) { white-space: nowrap; }
.optizzz-work-queue-bar {
  display: inline-block; vertical-align: middle; width: 80px; height: 8px; margin-right: 6px;
  border: 1px solid #000; background: linear-gradient(to right, #6b8e23 var(--progress, 0%), transparent 0);
}`;

/** Table of the buildings / research in progress, on construction.php and laboratoire.php. */
export const workQueue: Feature = {
  id: "work-queue",
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
