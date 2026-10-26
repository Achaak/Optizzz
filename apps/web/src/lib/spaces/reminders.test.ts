import { describe, expect, it } from "vitest";
import {
  isReminderKind,
  maskedWebhook,
  OFFERED_REMINDER_KINDS,
  reminderText,
  REMINDER_KINDS,
  webhookHash,
} from "./reminders";

const LINK = "https://optizzz.fr/spaces/0b0e4f4c-1d2e-4a3b-8c4d-5e6f7a8b9c0d";

describe("the site's reminders on Discord", () => {
  it("say the space, the kind of event and the link, nothing else", () => {
    expect(reminderText("join-requests", "Les Messors", LINK)).toBe(
      `Nouvelle demande pour rejoindre l'espace Les Messors, à voir sur Optizzz : <${LINK}>`,
    );
    expect(reminderText("demands", "Les Messors", LINK)).toBe(
      `Nouvelle Demande à valider sur l'espace Les Messors, à voir sur Optizzz : <${LINK}>`,
    );
    expect(reminderText("floods", "Les Messors", LINK)).toBe(
      `Nouveaux floods sur l'espace Les Messors, à voir sur Optizzz : <${LINK}>`,
    );
  });

  it("escape the space's name: never formatting nor a link", () => {
    expect(reminderText("floods", "**[x](https://evil.example)**", LINK)).toContain(
      "\\*\\*\\[x\\]\\(https://evil.example\\)\\*\\*",
    );
  });

  it("offer every kind but the Demandes, which wait for ticket 23", () => {
    expect(OFFERED_REMINDER_KINDS).toEqual(["join-requests", "floods"]);
    expect(REMINDER_KINDS).toContain("demands");
    expect(isReminderKind("floods")).toBe(true);
    expect(isReminderKind("army")).toBe(false);
  });

  it("show a webhook masked, and compare two by their hash", async () => {
    const url = "https://discord.com/api/webhooks/123456789012345678/AbC-def_GHIjkl";
    expect(maskedWebhook(url)).toBe("discord.com/api/webhooks/1234…/••••Ijkl");
    expect(await webhookHash(url)).toMatch(/^[0-9a-f]{64}$/);
    expect(await webhookHash(url)).toBe(await webhookHash(url));
    expect(await webhookHash(url)).not.toBe(await webhookHash(`${url}x`));
  });
});
