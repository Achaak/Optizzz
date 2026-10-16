import type { Feature } from "../feature";
import { ATTACKS_STYLE, renderAttacksOnWay } from "./mount";

/**
 * On Armee.php and the attack form (ennemie.php?Attaquer=…), where the game lists them the same way: the attacks on
 * their way as a list, each one copied in a click. See docs/features/attaques-en-cours.md.
 */
export const attacksOnWay: Feature = {
  id: "attacks-on-way",
  toggle: "attacks-on-way",
  matches: (url) =>
    url.pathname.toLowerCase() === "/armee.php" ||
    (url.pathname.toLowerCase() === "/ennemie.php" && url.searchParams.has("Attaquer")),
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
