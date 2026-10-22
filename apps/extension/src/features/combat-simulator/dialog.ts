// The simulator over the game page, framed in a dialog (src/utils/page-dialog.ts).
import type { ContentScriptContext } from "wxt/utils/content-script-context";
import { createPageDialog } from "@/utils/page-dialog";
import { requestSimulator, simulatorUrl } from "./open";

let shared: ReturnType<typeof createPageDialog> | undefined;

/**
 * The page's one simulator dialog: the top bar button and « Outils » open the same one. `open(opponent)` starts it
 * from an army seen in a report (`encodeOpponent`).
 */
export function simulatorDialog(ctx: ContentScriptContext) {
  shared ??= createPageDialog(ctx, {
    name: "optizzz-combat-simulator",
    title: "Simulateur de combat",
    src: (opponent) => simulatorUrl(location.host, "attack", { embedded: true, opponent }),
    openInTab: (opponent) => requestSimulator(location.host, "attack", opponent),
  });
  return shared;
}
