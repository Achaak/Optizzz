import type { Feature } from "../feature";
import { readLevels, storeLevels } from "./levels";

/** Remembers research and building levels when the player opens laboratoire.php or construction.php. */
export const gameLevels: Feature = {
  id: "game-levels",
  matches: (url) => /^\/(construction|laboratoire)\.php$/i.test(url.pathname),
  async run() {
    await storeLevels(location.origin, readLevels(document));
  },
};
