import { describe, expect, it, vi } from "vitest";
import { buildSettingsDialog, settingsTabs, type SettingsTab } from "./dialog";

const tab = (id: string): SettingsTab => ({
  id,
  label: id,
  render: (doc) => Object.assign(doc.createElement("p"), { textContent: `content ${id}` }),
});

describe("buildSettingsDialog", () => {
  it("shows the first tab and switches tabs on click", () => {
    const dialog = buildSettingsDialog(document, [tab("a"), tab("b")], vi.fn());
    const [first, second] = dialog.querySelectorAll<HTMLButtonElement>('[role="tab"]');

    expect(dialog.querySelector(".dialog-body")?.textContent).toBe("content a");
    expect(first?.getAttribute("aria-selected")).toBe("true");
    second?.click();
    expect(dialog.querySelector(".dialog-body")?.textContent).toBe("content b");
    expect(first?.getAttribute("aria-selected")).toBe("false");
  });

  it("calls onClose from the close button", () => {
    const onClose = vi.fn();
    buildSettingsDialog(document, [tab("a")], onClose)
      .querySelector<HTMLButtonElement>(".dialog-close")
      ?.click();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("shows the version and the issue links in « À propos »", () => {
    const dialog = buildSettingsDialog(document, settingsTabs("1.2.3", "Firefox/142"), vi.fn());
    expect(dialog.textContent).toContain("Version 1.2.3");
    const labels = [...dialog.querySelectorAll(".about-links a")].map((link) => link.textContent);
    expect(labels).toEqual(["Code source sur GitHub", "Signaler un bug", "Proposer une fonctionnalité"]);
  });
});
