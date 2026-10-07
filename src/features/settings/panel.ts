import type { ContentScriptContext } from "wxt/utils/content-script-context";
import type { ShadowRootContentScriptUi } from "wxt/utils/content-script-ui/shadow-root";
import { requestSimulator } from "../combat-simulator/open";
import { loadToggles, setToggle } from "../toggles";
import { buildSettingsDialog, DIALOG_STYLE, settingsTabs } from "./dialog";

/** Opens the settings dialog over the game, or closes it when it is already open. */
export function createSettingsPanel(ctx: ContentScriptContext) {
  let ui: ShadowRootContentScriptUi<() => void> | undefined;

  const close = () => {
    ui?.remove();
    ui = undefined;
  };

  async function open() {
    const toggles = await loadToggles();
    ui = await createShadowRootUi(ctx, {
      name: "optizzz-settings",
      position: "inline",
      anchor: "body",
      append: "last",
      css: `${DIALOG_STYLE}\n:host { position: relative; z-index: 30000; }`,
      onMount(container) {
        const tabs = settingsTabs(
          browser.runtime.getManifest().version,
          navigator.userAgent,
          {
            toggles,
            onChange: (feature, option, enabled) => {
              setToggle(feature, option, enabled).catch((error: unknown) => {
                console.error("[Optizzz] saving a feature toggle failed", error);
              });
            },
            reload: () => location.reload(),
          },
          {
            openSimulator: () => {
              requestSimulator(location.host, "attack").catch((error: unknown) => {
                console.error("[Optizzz] could not open the combat simulator", error);
              });
            },
          },
        );
        container.append(buildSettingsDialog(document, tabs, close));
        const onKeyDown = (event: KeyboardEvent) => {
          if (event.key === "Escape") close();
        };
        document.addEventListener("keydown", onKeyDown);
        return () => document.removeEventListener("keydown", onKeyDown);
      },
      onRemove: (removeListener) => removeListener?.(),
    });
    ui.mount();
  }

  return {
    toggle: async () => {
      if (ui) close();
      else await open();
    },
  };
}
