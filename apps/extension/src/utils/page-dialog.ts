// An extension page over the game page: a dialog framing it, so the content script loaded on every page stays free of
// React. The page must be listed in web_accessible_resources (wxt.config.ts). Combat simulator, server map.
import type { ContentScriptContext } from "wxt/utils/content-script-context";
import type { ShadowRootContentScriptUi } from "wxt/utils/content-script-ui/shadow-root";
import { DIALOG_STYLE } from "@/features/settings/dialog";
import { THEME_CSS } from "@/theme";
import { CLOSE_PAGE_DIALOG_MESSAGE } from "./page-dialog-frame";

export const PAGE_DIALOG_STYLE = `${DIALOG_STYLE}
.dialog.page-dialog { top: 40px; width: 1140px; height: calc(100vh - 60px); max-height: none; }
.page-frame { flex: 1; width: 100%; border: none; border-top: 1px solid var(--optizzz-border); background: var(--optizzz-surface); }
.page-new-tab {
  margin: 2px 0 0; padding: 0; border: none; background: none; font: inherit;
  font-size: var(--optizzz-font-size-small); color: var(--optizzz-text-muted); text-decoration: underline; cursor: pointer;
}`;

export interface PageDialogInput {
  title: string;
  /** Address of the framed page. */
  src: string;
  onClose: () => void;
  /** Opens the same page in a tab of its own. */
  onNewTab: () => void;
}

/** Title, close button and the framed page. */
export function buildPageDialog(doc: Document, input: PageDialogInput): HTMLElement {
  const dialog = doc.createElement("div");
  dialog.className = "dialog page-dialog";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-labelledby", "optizzz-page-dialog-title");

  const header = doc.createElement("div");
  header.className = "dialog-header";
  const title = doc.createElement("h2");
  title.className = "dialog-title";
  title.id = "optizzz-page-dialog-title";
  title.textContent = input.title;
  const newTab = doc.createElement("button");
  newTab.type = "button";
  newTab.className = "page-new-tab";
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
  frame.className = "page-frame";
  frame.title = input.title;
  frame.src = input.src;

  dialog.append(header, frame);
  return dialog;
}

export interface PageDialogSpec {
  /** Name of the shadow root host element. */
  name: string;
  title: string;
  /** Address of the framed page when opened with `target`. */
  src: (target: string | undefined) => string;
  /** Asks the background script for a tab (a content script cannot open an extension page). */
  openInTab: (target: string | undefined) => Promise<unknown>;
}

/** One dialog per page and spec: opening it again while it is open shows the new target. */
export function createPageDialog(ctx: ContentScriptContext, spec: PageDialogSpec) {
  let ui: ShadowRootContentScriptUi<() => void> | undefined;
  /** Set while the dialog is being opened: a second quick click must not open a second one. */
  let opening: Promise<void> | undefined;

  const close = () => {
    ui?.remove();
    ui = undefined;
  };

  async function open(target: string | undefined) {
    ui = await createShadowRootUi(ctx, {
      name: spec.name,
      position: "inline",
      anchor: "body",
      append: "last",
      css: `${THEME_CSS}\n${PAGE_DIALOG_STYLE}\n:host { position: relative !important; z-index: 30000 !important; }`,
      onMount(container) {
        const dialog = buildPageDialog(document, {
          title: spec.title,
          src: spec.src(target),
          onClose: close,
          onNewTab: () => {
            close();
            spec.openInTab(target).catch((error: unknown) => {
              console.error(`[Optizzz] could not open « ${spec.title} »`, error);
            });
          },
        });
        container.append(dialog);
        const frame = dialog.querySelector("iframe");
        const onKeyDown = (event: KeyboardEvent) => {
          if (event.key === "Escape") close();
        };
        // Escape pressed inside the framed page: it cannot reach this one's keys, it asks.
        const onMessage = (event: MessageEvent) => {
          if (event.source === frame?.contentWindow && event.data === CLOSE_PAGE_DIALOG_MESSAGE) close();
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

  const show = async (target?: string) => {
    if (ui && target === undefined) return;
    close();
    opening ??= open(target).finally(() => {
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
