import type { Feature } from "../feature";
import { ATTACKS_STYLE, renderAttacksOnWay } from "./mount";

/** On Armee.php: the attacks on their way as a list, each one copied in a click. See docs/features/attaques-en-cours.md. */
export const attacksOnWay: Feature = {
  id: "attacks-on-way",
  toggle: "attacks-on-way",
  matches: (url) => url.pathname.toLowerCase() === "/armee.php",
  run(ctx) {
    const style = document.createElement("style");
    style.textContent = ATTACKS_STYLE;
    document.head.append(style);
    ctx.onInvalidated(
      renderAttacksOnWay(
        document,
        () => new Date(),
        (text) => navigator.clipboard.writeText(text),
      ),
    );
  },
};
