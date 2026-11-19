// What unlocking a unit, a building or a research costs, from the levels Construction and Laboratoire show. See
// docs/features/cout-deblocage.md.
import { readLevelRows } from "@optizzz/game/pages/level-rows";
import { readLockedUnits } from "@optizzz/game/pages/queen";
import { unlockCost } from "@optizzz/game/requirements";
import { fetchGamePage } from "@/utils/game-page";
import type { Feature } from "../feature";
import { isEnabled } from "../toggles";
import { mountUnlockCost, UNLOCK_STYLE } from "./mount";

/** Each page and the pages read in the background for the rows it does not show. */
const PAGES = {
  "/reine.php": { option: "queen", others: ["construction.php", "laboratoire.php"] },
  "/construction.php": { option: "levels", others: ["laboratoire.php"] },
  "/laboratoire.php": { option: "levels", others: ["construction.php"] },
} as const;

/**
 * On Reine.php, under each locked unit; on construction.php and laboratoire.php, under each row whose next level
 * waits for a requirement: what reaching the requirements costs.
 */
export const unlockCosts: Feature = {
  id: "unlock-costs",
  toggle: "unlock-costs",
  matches: (url) => url.pathname.toLowerCase() in PAGES,
  async run(_ctx, toggles) {
    const page = PAGES[location.pathname.toLowerCase() as keyof typeof PAGES];
    const on =
      page.option === "queen"
        ? isEnabled(toggles, "unlock-costs", "queen")
        : isEnabled(toggles, "unlock-costs", "levels");
    if (!on) return;
    const own = page.option === "queen" ? [] : readLevelRows([document]);
    const locked =
      page.option === "queen"
        ? readLockedUnits(document).map((unit) => ({ ...unit, rowLevel: null }))
        : own
            .filter((row) => row.description.querySelector(".verificationNonOK"))
            .map((row) => ({ ...row, rowLevel: row.level + 1 }));
    if (locked.length === 0) return;
    const others = await Promise.all(
      page.others.map((other) => fetchGamePage(`${location.origin}/${other}`).catch(() => null)),
    );
    const rows = [...own, ...readLevelRows(others.filter((doc): doc is Document => doc !== null))];
    const style = document.createElement("style");
    style.textContent = UNLOCK_STYLE;
    document.head.append(style);
    for (const { description, requirements, rowLevel } of locked) {
      mountUnlockCost(description, unlockCost(requirements, rows), rowLevel);
    }
  },
};
