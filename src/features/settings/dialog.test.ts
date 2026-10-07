import { describe, expect, it, vi } from "vitest";
import { buildSettingsDialog, settingsTabs, type FeaturesTabInput, type SettingsTab } from "./dialog";

const tab = (id: string): SettingsTab => ({
  id,
  label: id,
  render: (doc) => Object.assign(doc.createElement("p"), { textContent: `content ${id}` }),
});

const features = (): FeaturesTabInput => ({ toggles: {}, onChange: vi.fn() });

const tabButton = (dialog: HTMLElement, label: string) =>
  [...dialog.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find((tab) => tab.textContent === label);

describe("buildSettingsDialog", () => {
  it("shows the first tab and switches tabs on click", () => {
    const dialog = buildSettingsDialog(document, [tab("a"), tab("b")], vi.fn());
    const [first, second] = dialog.querySelectorAll<HTMLButtonElement>('[role="tab"]');

    expect(dialog.querySelector(".tab-panel")?.textContent).toBe("content a");
    expect(first?.getAttribute("aria-selected")).toBe("true");
    second?.click();
    expect(dialog.querySelector(".tab-panel")?.textContent).toBe("content b");
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
    const dialog = buildSettingsDialog(document, settingsTabs("1.2.3", "Firefox/142", features()), vi.fn());
    tabButton(dialog, "À propos")?.click();
    expect(dialog.textContent).toContain("Version 1.2.3");
    const labels = [...dialog.querySelectorAll(".about-links a")].map((link) => link.textContent);
    expect(labels).toEqual(["Code source sur GitHub", "Signaler un bug", "Proposer une fonctionnalité"]);
  });

  it("opens on « Fonctionnalités » and keeps a change when coming back to it", () => {
    const input = features();
    const dialog = buildSettingsDialog(document, settingsTabs("1.2.3", "Firefox/142", input), vi.fn());
    const box = () => dialog.querySelector<HTMLInputElement>('input[data-toggle="work-queue"]');

    const workQueue = box();
    if (!workQueue) throw new Error("checkbox not found");
    workQueue.checked = false;
    workQueue.dispatchEvent(new Event("change"));
    expect(input.onChange).toHaveBeenCalledWith("work-queue", undefined, false);

    tabButton(dialog, "À propos")?.click();
    tabButton(dialog, "Fonctionnalités")?.click();
    expect(box()?.checked).toBe(false);
  });
});
