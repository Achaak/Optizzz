import { describe, expect, it, vi } from "vitest";
import { buildNotificationsSection, type NotificationsTabInput } from "./notifications-section";

const checkbox = (section: HTMLElement, kind: string) => {
  const input = section.querySelector<HTMLInputElement>(`input[data-notification="${kind}"]`);
  if (!input) throw new Error(`no checkbox for ${kind}`);
  return input;
};

// As the browser does on a click: flip the box, then fire « change ».
const click = (input: HTMLInputElement) => {
  input.checked = !input.checked;
  input.dispatchEvent(new Event("change"));
};

const build = (overrides: Partial<NotificationsTabInput> = {}) => {
  const input: NotificationsTabInput = {
    settings: {},
    permitted: () => Promise.resolve(true),
    onChange: vi.fn(),
    grant: vi.fn(),
    ...overrides,
  };
  return { input, section: buildNotificationsSection(document, input) };
};

describe("buildNotificationsSection", () => {
  it("lists the four kinds, all off by default", () => {
    const { section } = build({ settings: { hunt: true } });
    expect(section.textContent).toContain("Famine");
    expect(section.textContent).toContain("Entrepôt plein");
    expect(section.textContent).toContain("Chantier terminé");
    expect(section.textContent).toContain("Chasse rentrée");
    expect(checkbox(section, "famine").checked).toBe(false);
    expect(checkbox(section, "hunt").checked).toBe(true);
  });

  it("saves a change", () => {
    const { input, section } = build();
    click(checkbox(section, "famine"));
    expect(input.onChange).toHaveBeenCalledWith("famine", true);
  });

  it("asks for the browser's permission when a kind is switched on without it", async () => {
    const { input, section } = build({ permitted: () => Promise.resolve(false) });
    await vi.waitFor(() => {
      expect(section.dataset.permitted).toBe("false");
    });
    click(checkbox(section, "famine"));
    await vi.waitFor(() => {
      expect(input.grant).toHaveBeenCalledTimes(1);
    });
  });

  it("waits for the browser's answer before asking, when a kind is switched on at once", async () => {
    const { input, section } = build({ permitted: () => Promise.resolve(false) });
    click(checkbox(section, "famine"));
    await vi.waitFor(() => {
      expect(input.grant).toHaveBeenCalledTimes(1);
    });
  });

  it("does not ask again once permitted", async () => {
    const { input, section } = build();
    await vi.waitFor(() => {
      expect(section.dataset.permitted).toBe("true");
    });
    click(checkbox(section, "famine"));
    expect(input.grant).not.toHaveBeenCalled();
  });

  it("says when the browser blocks the kinds switched on, with a way to allow them", async () => {
    const { input, section } = build({ settings: { famine: true }, permitted: () => Promise.resolve(false) });
    await vi.waitFor(() => {
      expect(section.textContent).toContain("Notifications pas encore autorisées par le navigateur");
    });
    section.querySelector<HTMLButtonElement>("button")?.click();
    expect(input.grant).toHaveBeenCalledTimes(1);
  });

  it("says nothing of the permission while every kind is off", async () => {
    const { section } = build({ permitted: () => Promise.resolve(false) });
    await vi.waitFor(() => {
      expect(section.dataset.permitted).toBe("false");
    });
    expect(section.textContent).not.toContain("pas encore autorisées");
  });

  it("says the notifications are switched off in « Fonctionnalités », and greys the boxes", () => {
    const { section } = build({ toggles: { "alerts.notifications": false } });
    expect(section.textContent).toContain("Notifications coupées dans « Fonctionnalités »");
    expect(checkbox(section, "famine").disabled).toBe(true);
  });

  it("says the end notifications need « Heures de fin »", () => {
    const { section } = build({ toggles: { "end-times": false } });
    expect(section.textContent).toContain("ont besoin de « Heures de fin »");
    expect(checkbox(section, "hunt").disabled).toBe(false);
  });
});
