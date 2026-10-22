import type { Feature } from "../feature";
import { insertSettingsButton } from "./menu-button";
import { createSettingsPanel } from "./panel";

/** Optizzz button in the game's top bar, opening the settings dialog (features, notifications, tools, about). */
export const settingsMenu: Feature = {
  id: "settings-menu",
  matches: () => true,
  run(ctx) {
    const panel = createSettingsPanel(ctx);
    insertSettingsButton(document, () => {
      panel.toggle().catch((error: unknown) => {
        console.error("[Optizzz] settings dialog failed", error);
      });
    });
  },
};
