import { describe, expect, it, vi } from "vitest";
import { buildFeaturesSection } from "./features-section";

const checkbox = (section: HTMLElement, key: string) =>
  section.querySelector<HTMLInputElement>(`input[data-toggle="${key}"]`);

// As the browser does on a click: flip the box, then fire « change ».
const click = (input: HTMLInputElement | null) => {
  if (!input) throw new Error("checkbox not found");
  input.checked = !input.checked;
  input.dispatchEvent(new Event("change"));
};

describe("buildFeaturesSection", () => {
  it("lists every feature and option, all on by default", () => {
    const section = buildFeaturesSection(document, {}, vi.fn());
    expect(section.textContent).toContain("Chantiers en cours");
    expect(section.textContent).toContain("Lanceur de chasse");
    const boxes = [...section.querySelectorAll<HTMLInputElement>("input[type=checkbox]")];
    expect(boxes.map((box) => box.dataset.toggle)).toEqual([
      "work-queue",
      "end-times",
      "end-times.inline",
      "end-times.recap",
      "resource-forecast",
      "resource-forecast.costs",
      "resource-forecast.outlook",
      "resource-forecast.simulator",
      "hunt-reports",
      "alliance-map",
      "hunt-launcher",
    ]);
    expect(boxes.every((box) => box.checked && !box.disabled)).toBe(true);
  });

  it("greys out the options of a switched-off feature and keeps their own state", () => {
    const section = buildFeaturesSection(
      document,
      { "resource-forecast": false, "resource-forecast.costs": false },
      vi.fn(),
    );
    expect(checkbox(section, "resource-forecast")?.checked).toBe(false);
    expect(checkbox(section, "resource-forecast.costs")?.disabled).toBe(true);
    expect(checkbox(section, "resource-forecast.costs")?.checked).toBe(false);
    expect(checkbox(section, "resource-forecast.outlook")?.checked).toBe(true);
  });

  it("reports a change and greys or frees the options", () => {
    const onChange = vi.fn();
    const section = buildFeaturesSection(document, {}, onChange);

    click(checkbox(section, "resource-forecast"));
    expect(onChange).toHaveBeenCalledWith("resource-forecast", undefined, false);
    expect(checkbox(section, "resource-forecast.simulator")?.disabled).toBe(true);

    click(checkbox(section, "resource-forecast"));
    expect(checkbox(section, "resource-forecast.simulator")?.disabled).toBe(false);

    click(checkbox(section, "resource-forecast.simulator"));
    expect(onChange).toHaveBeenLastCalledWith("resource-forecast", "simulator", false);
  });

  it("offers to reload the page once something changed", () => {
    const reload = vi.fn();
    const section = buildFeaturesSection(document, {}, vi.fn(), reload);
    expect(section.querySelector(".features-reload")).toBeNull();

    click(checkbox(section, "work-queue"));
    section.querySelector<HTMLButtonElement>(".features-reload button")?.click();
    expect(reload).toHaveBeenCalledOnce();
  });

  it("asks to reload the game pages when it cannot do it itself", () => {
    const section = buildFeaturesSection(document, {}, vi.fn());
    click(checkbox(section, "work-queue"));
    expect(section.querySelector(".features-reload")?.textContent).toContain("Rechargez les pages du jeu");
    expect(section.querySelector(".features-reload button")).toBeNull();
  });
});
