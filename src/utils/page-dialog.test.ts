import { describe, expect, it, vi } from "vitest";
import { buildPageDialog } from "./page-dialog";

describe("buildPageDialog", () => {
  const input = () => ({
    title: "Simulateur de combat",
    src: "chrome-extension://id/combat-simulator.html?side=attack",
    onClose: vi.fn(),
    onNewTab: vi.fn(),
  });

  it("frames the page under its title", () => {
    const dialog = buildPageDialog(document, input());
    expect(dialog.getAttribute("role")).toBe("dialog");
    expect(dialog.querySelector(".dialog-title")?.textContent).toBe("Simulateur de combat");
    expect(dialog.querySelector("iframe")?.getAttribute("src")).toBe(
      "chrome-extension://id/combat-simulator.html?side=attack",
    );
  });

  it("closes, or opens the page in a tab of its own", () => {
    const callbacks = input();
    const dialog = buildPageDialog(document, callbacks);
    dialog.querySelector<HTMLElement>(".dialog-close")?.click();
    expect(callbacks.onClose).toHaveBeenCalledOnce();
    dialog.querySelector<HTMLElement>(".page-new-tab")?.click();
    expect(callbacks.onNewTab).toHaveBeenCalledOnce();
  });
});
