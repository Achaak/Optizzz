import type { Feature } from "../feature";
import { safeUrl } from "./safe-url";

/**
 * Reloading must not replay a ponte, a hunt or a building. Replacing the history entry turns a page
 * shown after a form (POST) into a plain visit, and drops the query of an action link (token `t`).
 */
export const safeReload: Feature = {
  id: "safe-reload",
  toggle: "safe-reload",
  matches: () => true,
  run() {
    history.replaceState(history.state, "", safeUrl(new URL(location.href)));
  },
};
