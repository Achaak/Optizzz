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
  it("lists every feature and option, all on by default but the options marked offByDefault", () => {
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
      "resource-forecast.levels",
      "resource-forecast.outlook",
      "resource-forecast.simulator",
      "alerts",
      "alerts.badge",
      "alerts.notifications",
      "laying-planner",
      "laying-templates",
      "convoy",
      "convoy.workers",
      "targets",
      "members-columns",
      "members-columns.trips",
      "members-columns.roles",
      "profile-production",
      "flood",
      "research-advice",
      "research-advice.weapons-shield",
      "research-advice.architecture",
      "research-advice.analysis-room",
      "research-advice.laying-boost",
      "research-advice.aphids",
      "attacks-on-way",
      "probes",
      "probes.field",
      "probes.nest",
      "probes.lodge",
      "hunt-reports",
      "combat-simulator",
      "alliance-map",
      "server-map",
      "server-map.button",
      "server-map.profile",
      "server-map.alliance",
      "watchlist",
      "watchlist.button",
      "watchlist.follow",
      "watchlist.popup",
      "tdc-chain",
      "history",
      "history.alliance",
      "history.profile",
      "alliance-stats",
      "alliance-stats.alliance",
      "alliance-stats.page",
      "alliance-sharing",
      "hunt-launcher",
      "safe-reload",
    ]);
    expect(boxes.filter((box) => !box.checked).map((box) => box.dataset.toggle)).toEqual(["probes.field"]);
    expect(boxes.every((box) => !box.disabled)).toBe(true);
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

  it("counts the features switched on", () => {
    const section = buildFeaturesSection(document, { "work-queue": false }, vi.fn());
    const count = () => section.querySelector(".features-count")?.textContent;
    expect(count()).toMatch(/^\d+ sur \d+ activées$/);
    const [on, all] = (count() ?? "").split(" sur ").map((part) => parseInt(part, 10));
    expect(on).toBe((all ?? 0) - 1);

    click(checkbox(section, "work-queue"));
    expect(count()).toBe(`${String(all)} sur ${String(all)} activées`);
  });

  it("filters the features by name, description or option, accents aside", () => {
    const section = buildFeaturesSection(document, {}, vi.fn());
    const filter = section.querySelector<HTMLInputElement>('input[type="search"]');
    const shown = () =>
      [...section.querySelectorAll<HTMLLIElement>(".features > li:not([hidden])")].map(
        (item) => item.querySelector<HTMLInputElement>("input")?.dataset.toggle,
      );
    const type = (text: string) => {
      if (!filter) throw new Error("filter not found");
      filter.value = text;
      filter.dispatchEvent(new Event("input"));
    };

    type("prevision");
    expect(shown()).toEqual(["resource-forecast"]);
    type("Prochaines fins");
    expect(shown()).toEqual(["end-times"]);
    type("zzzz");
    expect(shown()).toEqual([]);
    expect(section.querySelector<HTMLElement>(".features-empty")?.hidden).toBe(false);
    type("");
    expect(shown()).toHaveLength(section.querySelectorAll(".features > li").length);
  });

  it("asks to reload the game pages when it cannot do it itself", () => {
    const section = buildFeaturesSection(document, {}, vi.fn());
    click(checkbox(section, "work-queue"));
    expect(section.querySelector(".features-reload")?.textContent).toContain("Rechargez les pages du jeu");
    expect(section.querySelector(".features-reload button")).toBeNull();
  });
});
