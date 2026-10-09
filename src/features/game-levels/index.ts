import type { Feature } from "../feature";
import { readLevels, storeLevels } from "@/data/levels";

/** Remembers research and building levels when the player opens laboratoire.php or construction.php. */
export const gameLevels: Feature = {
  id: "game-levels",
  matches: (url) => /^\/(construction|laboratoire)\.php$/i.test(url.pathname),
  async run() {
    const page = location.pathname.toLowerCase() === "/laboratoire.php" ? "laboratoire.php" : "construction.php";
    await storeLevels(location.origin, readLevels(document), page);
  },
};
