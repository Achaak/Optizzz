// The framed side of page-dialog.ts, light enough for the extension's own pages.

/** Sent by a framed page to the dialog around it when Escape is pressed inside. */
export const CLOSE_PAGE_DIALOG_MESSAGE = "optizzz:close-page-dialog";

/** In a framed page: its keys do not reach the game page, Escape asks the dialog to close. */
export function closeOnEscapeWhenFramed(): void {
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") window.parent.postMessage(CLOSE_PAGE_DIALOG_MESSAGE, "*");
  });
}
