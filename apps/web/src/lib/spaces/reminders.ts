// The site's own reminders on Discord (docs/features/site-discord.md, « Rappels du site »; ADR 0005, « Discord »):
// content-free messages the site posts on a second webhook an Admin gives it, so the alliance hears of something new
// even when no member's browser is open. Shared by the space page (labels, the warning when both webhooks are one)
// and the site's server (the message itself).
import { escapeDiscord } from "@optizzz/game/site-links/discord";

/** The events a reminder can tell, each off by default. Only what the site sees in clear, never a state. */
export const REMINDER_KINDS = ["join-requests", "demands", "floods"] as const;
export type ReminderKind = (typeof REMINDER_KINDS)[number];

export const isReminderKind = (value: unknown): value is ReminderKind =>
  (REMINDER_KINDS as readonly unknown[]).includes(value);

/**
 * What the space page offers. « Demandes à valider » comes with the Demandes (ticket 23), which call the site's hook
 * (`remindLater`, src/server/reminders/service.ts) once a Demande waits to be validated.
 */
export const OFFERED_REMINDER_KINDS: readonly ReminderKind[] = ["join-requests", "floods"];

export const REMINDER_LABELS: Record<ReminderKind, string> = {
  "join-requests": "Demandes pour rejoindre l'espace",
  demands: "Demandes à valider",
  floods: "Nouveaux floods",
};

/**
 * The message: the space's name, the kind of event, the link to the space. Never a pseudo, a number, a target nor a
 * time. The link between angle brackets: Discord shows no preview.
 */
export const reminderText = (kind: ReminderKind, spaceName: string, link: string): string =>
  `${reminderLine(kind, escapeDiscord(spaceName))}, à voir sur Optizzz : <${link}>`;

/** « Nouveaux floods sur l'espace XYZ »: what the reminder says, as the space page shows it. */
export function reminderLine(kind: ReminderKind, spaceName: string): string {
  return {
    "join-requests": `Nouvelle demande pour rejoindre l'espace ${spaceName}`,
    demands: `Nouvelle Demande à valider sur l'espace ${spaceName}`,
    floods: `Nouveaux floods sur l'espace ${spaceName}`,
  }[kind];
}

/** « discord.com/api/webhooks/1234…/••••abcd »: enough to recognise it, not to copy it from over a shoulder. */
export function maskedWebhook(url: string): string {
  const [, id = "", token = ""] = /\/api\/webhooks\/(\d+)\/(.+)$/.exec(url) ?? [];
  return `discord.com/api/webhooks/${id.slice(0, 4)}…/••••${token.slice(-4)}`;
}

/**
 * SHA-256 of a webhook's address, in hex: the site gives the Admins this hash of the reminders' address, and their
 * page compares it with the announcements' address it decrypted, without the site handing the address out.
 */
export async function webhookHash(url: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(url));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
