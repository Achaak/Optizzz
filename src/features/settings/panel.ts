import type { ContentScriptContext } from "wxt/utils/content-script-context";
import type { ShadowRootContentScriptUi } from "wxt/utils/content-script-ui/shadow-root";
import { loadNotificationSettings, setNotification } from "../alerts/notification-settings";
import { askGrantPage, askNotificationsPermitted } from "../alerts/permission";
import { simulatorDialog } from "../combat-simulator/dialog";
import { loadToggles, setToggle } from "../toggles";
import { buildSettingsDialog, DIALOG_STYLE, settingsTabs } from "./dialog";
import { BUTTON_CLASS } from "./menu-button";
import { THEME_CSS } from "@/theme";

/** Opens the settings dialog over the game, or closes it when it is already open. */
export function createSettingsPanel(ctx: ContentScriptContext) {
  let ui: ShadowRootContentScriptUi<() => void> | undefined;
  /** Set while the dialog is being opened: a second quick click must not open a second one. */
  let opening: Promise<void> | undefined;

  const close = () => {
    ui?.remove();
    ui = undefined;
    // Back to the gear, for the keyboard.
    document.querySelector<HTMLElement>(`.${BUTTON_CLASS}`)?.focus();
  };

  async function open() {
    const [toggles, notificationSettings] = await Promise.all([loadToggles(), loadNotificationSettings()]);
    ui = await createShadowRootUi(ctx, {
      name: "optizzz-settings",
      position: "inline",
      anchor: "body",
      append: "last",
      css: `${THEME_CSS}\n${DIALOG_STYLE}\n:host { position: relative !important; z-index: 30000 !important; }`,
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
              close();
              simulatorDialog(ctx)
                .open()
                .catch((error: unknown) => {
                  console.error("[Optizzz] combat simulator dialog failed", error);
                });
            },
          },
          {
            settings: notificationSettings,
            permitted: askNotificationsPermitted,
            onChange: (kind, enabled) => {
              setNotification(kind, enabled).catch((error: unknown) => {
                console.error("[Optizzz] saving a notification setting failed", error);
              });
            },
            grant: () => {
              askGrantPage().catch((error: unknown) => {
                console.error("[Optizzz] could not open the notifications permission page", error);
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
    ui.uiContainer.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus();
  }

  return {
    toggle: async () => {
      if (ui) close();
      else if (!opening) {
        opening = open().finally(() => {
          opening = undefined;
        });
        await opening;
      }
    },
  };
}
