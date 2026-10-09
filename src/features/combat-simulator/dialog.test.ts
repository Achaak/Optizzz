import { describe, expect, it, vi } from "vitest";
import { buildSimulatorDialog } from "./dialog";

describe("buildSimulatorDialog", () => {
  const input = () => ({
    src: "chrome-extension://id/combat-simulator.html?side=attack",
    onClose: vi.fn(),
    onNewTab: vi.fn(),
  });

  it("frames the simulator page under its title", () => {
    const dialog = buildSimulatorDialog(document, input());
    expect(dialog.getAttribute("role")).toBe("dialog");
    expect(dialog.querySelector(".dialog-title")?.textContent).toBe("Simulateur de combat");
    expect(dialog.querySelector("iframe")?.getAttribute("src")).toBe(
      "chrome-extension://id/combat-simulator.html?side=attack",
    );
  });

  it("closes, or opens the simulator in a tab of its own", () => {
    const callbacks = input();
    const dialog = buildSimulatorDialog(document, callbacks);
    dialog.querySelector<HTMLElement>(".dialog-close")?.click();
    expect(callbacks.onClose).toHaveBeenCalledOnce();
    dialog.querySelector<HTMLElement>(".simulator-new-tab")?.click();
    expect(callbacks.onNewTab).toHaveBeenCalledOnce();
  });
});
