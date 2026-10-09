// The simulator over the game page: a dialog framing the extension's own page, so the content script loaded on every
// page stays free of React. The page is listed in web_accessible_resources (wxt.config.ts) for that.
import type { ContentScriptContext } from "wxt/utils/content-script-context";
import type { ShadowRootContentScriptUi } from "wxt/utils/content-script-ui/shadow-root";
import { DIALOG_STYLE } from "../settings/dialog";
import { THEME_CSS } from "@/theme";
import { CLOSE_SIMULATOR_MESSAGE, requestSimulator, simulatorUrl } from "./open";

export const SIMULATOR_DIALOG_STYLE = `${DIALOG_STYLE}
.dialog.simulator-dialog { top: 40px; width: 1140px; height: calc(100vh - 60px); max-height: none; }
.simulator-frame { flex: 1; width: 100%; border: none; border-top: 1px solid var(--optizzz-border); background: var(--optizzz-surface); }
.simulator-new-tab {
  margin: 2px 0 0; padding: 0; border: none; background: none; font: inherit;
  font-size: var(--optizzz-font-size-small); color: var(--optizzz-text-muted); text-decoration: underline; cursor: pointer;
}`;

export interface SimulatorDialogInput {
  /** Address of the simulator page. */
  src: string;
  onClose: () => void;
  /** Opens the same simulator in a tab of its own. */
  onNewTab: () => void;
}

/** Title, close button and the framed simulator page. */
export function buildSimulatorDialog(doc: Document, input: SimulatorDialogInput): HTMLElement {
  const dialog = doc.createElement("div");
  dialog.className = "dialog simulator-dialog";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-labelledby", "optizzz-simulator-title");

  const header = doc.createElement("div");
  header.className = "dialog-header";
  const title = doc.createElement("h2");
  title.className = "dialog-title";
  title.id = "optizzz-simulator-title";
  title.textContent = "Simulateur de combat";
  const newTab = doc.createElement("button");
  newTab.type = "button";
  newTab.className = "simulator-new-tab";
  newTab.textContent = "Ouvrir dans un nouvel onglet";
  newTab.addEventListener("click", input.onNewTab);
  const close = doc.createElement("button");
  close.type = "button";
  close.className = "dialog-close";
  close.title = "Fermer";
  close.setAttribute("aria-label", "Fermer");
  close.textContent = "×";
  close.addEventListener("click", input.onClose);
  header.append(title, newTab, close);

  const frame = doc.createElement("iframe");
  frame.className = "simulator-frame";
  frame.title = "Simulateur de combat";
  frame.src = input.src;

  dialog.append(header, frame);
  return dialog;
}

let shared: ReturnType<typeof createSimulatorDialog> | undefined;

/** The page's one simulator dialog: the top bar button and « Outils » open the same one. */
export function simulatorDialog(ctx: ContentScriptContext) {
  shared ??= createSimulatorDialog(ctx);
  return shared;
}

function createSimulatorDialog(ctx: ContentScriptContext) {
  let ui: ShadowRootContentScriptUi<() => void> | undefined;
  /** Set while the dialog is being opened: a second quick click must not open a second one. */
  let opening: Promise<void> | undefined;

  const close = () => {
    ui?.remove();
    ui = undefined;
  };

  async function open() {
    ui = await createShadowRootUi(ctx, {
      name: "optizzz-combat-simulator",
      position: "inline",
      anchor: "body",
      append: "last",
      css: `${THEME_CSS}\n${SIMULATOR_DIALOG_STYLE}\n:host { position: relative !important; z-index: 30000 !important; }`,
      onMount(container) {
        const dialog = buildSimulatorDialog(document, {
          src: simulatorUrl(location.host, "attack", { embedded: true }),
          onClose: close,
          onNewTab: () => {
            close();
            requestSimulator(location.host, "attack").catch((error: unknown) => {
              console.error("[Optizzz] could not open the combat simulator", error);
            });
          },
        });
        container.append(dialog);
        const frame = dialog.querySelector("iframe");
        const onKeyDown = (event: KeyboardEvent) => {
          if (event.key === "Escape") close();
        };
        // Escape pressed inside the simulator: the page cannot reach this one's keys, it asks.
        const onMessage = (event: MessageEvent) => {
          if (event.source === frame?.contentWindow && event.data === CLOSE_SIMULATOR_MESSAGE) close();
        };
        document.addEventListener("keydown", onKeyDown);
        window.addEventListener("message", onMessage);
        return () => {
          document.removeEventListener("keydown", onKeyDown);
          window.removeEventListener("message", onMessage);
        };
      },
      onRemove: (removeListeners) => removeListeners?.(),
    });
    ui.mount();
    ui.uiContainer.querySelector("iframe")?.focus();
  }

  const show = async () => {
    if (ui) return;
    opening ??= open().finally(() => {
      opening = undefined;
    });
    await opening;
  };

  return {
    open: show,
    toggle: async () => {
      if (ui) close();
      else await show();
    },
  };
}
