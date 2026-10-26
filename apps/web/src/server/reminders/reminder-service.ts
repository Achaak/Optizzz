// The rules of the site's reminders on Discord (docs/features/site-discord.md, « Rappels du site »; ADR 0005,
// « Discord »). An Admin gives the site a second webhook, not the announcements' one, and chooses the kinds of events
// (each off by default). At an event the site sees in clear (a request to join, new flood rows, a Demande to validate),
// it posts a content-free line there: the space's name, the kind, the link. Never a pseudo, a number, a target or a time.
// One reminder of a kind every 30 minutes at most per space; Discord saying the webhook is gone suspends them.
import { normalizeWebhookUrl } from "@optizzz/game/site-links/discord";
import { isReminderKind, maskedWebhook, reminderText, REMINDER_KINDS, webhookHash } from "~/lib/spaces/reminders";
import type { ReminderKind } from "~/lib/spaces/reminders";
import { SpaceError } from "~/server/spaces/space-service";
import { openUrl, sealUrl } from "./at-rest";
import { postReminder } from "./post";
import type { ReminderStore } from "./store";

/** One reminder of a kind per space in this window at most. */
const WINDOW = 30 * 60_000;

const NOT_A_WEBHOOK =
  "Ce n'est pas l'adresse d'un webhook Discord : elle commence par https://discord.com/api/webhooks/. Copiez-la dans Discord, depuis Paramètres du salon › Intégrations › Webhooks.";
const UNAVAILABLE = "Les rappels du site ne sont pas encore disponibles sur optizzz.fr.";

interface Dependencies {
  store: ReminderStore;
  /** DISCORD_REMINDERS_KEY, read (at-rest.ts): null when unset or malformed, and the reminders stay off. */
  key: Buffer | null;
  fetcher: typeof fetch;
  /** The site's own address, for the link to the space. */
  origin: string;
  now?: () => Date;
}

/** What `remind` did, for the tests and the logs. */
type RemindResult = "sent" | "skipped" | "dropped" | "suspended";

export function reminderService({ store, key, fetcher, origin, now = () => new Date() }: Dependencies) {
  async function asAdmin(userId: string, spaceId: string) {
    const role = await store.roleOf(spaceId, userId);
    if (!role) throw new SpaceError("forbidden", "Vous n'êtes pas membre de cet espace.");
    if (role !== "admin") throw new SpaceError("forbidden", "Seul un Admin de l'espace peut le faire.");
  }

  function checkKinds(kinds: readonly unknown[]): ReminderKind[] {
    if (kinds.length > 20 || !kinds.every(isReminderKind)) throw new SpaceError("invalid", "Demande incomplète.");
    return REMINDER_KINDS.filter((kind) => kinds.includes(kind));
  }

  async function remind(spaceId: string, kind: ReminderKind): Promise<RemindResult> {
    if (!key) return "skipped";
    const row = await store.reminders(spaceId);
    if (!row || row.suspension || !row.kinds.includes(kind)) return "skipped";
    const url = openUrl(key, spaceId, row.sealedUrl);
    const name = await store.spaceName(spaceId);
    if (!url || name === null) return "skipped";
    const at = now();
    if (!(await store.claim(spaceId, kind, at, new Date(at.getTime() - WINDOW)))) return "skipped";
    const result = await postReminder(fetcher, url, reminderText(kind, name, `${origin}/spaces/${spaceId}`));
    if (result.kind === "suspend") {
      await store.suspend(spaceId, row.sealedUrl, result.status, at);
      return "suspended";
    }
    return result.kind;
  }

  return {
    /** For an Admin: whether the site can post reminders, the address masked (and its hash), the kinds. */
    async view(userId: string, spaceId: string) {
      await asAdmin(userId, spaceId);
      const row = await store.reminders(spaceId);
      const url = row && key ? openUrl(key, spaceId, row.sealedUrl) : null;
      return {
        available: key !== null,
        address: url ? { masked: maskedWebhook(url), hash: await webhookHash(url) } : null,
        /** Saved, but it does not open with the site's key today: to enter again. */
        unreadable: row !== null && key !== null && url === null,
        kinds: row ? checkKinds(row.kinds.filter(isReminderKind)) : [],
        suspension: row?.suspension ?? null,
      };
    },

    /**
     * Saves the reminders' address and kinds: `url` a new address (the suspension is forgotten), null to remove
     * everything (« Retirer l'adresse »), absent to change the kinds alone.
     */
    async save(userId: string, input: { spaceId: string; url?: string | null; kinds: readonly unknown[] }) {
      await asAdmin(userId, input.spaceId);
      if (input.url === null) {
        await store.removeReminders(input.spaceId);
        return;
      }
      if (!key) throw new SpaceError("invalid", UNAVAILABLE);
      const kinds = checkKinds(input.kinds);
      if (input.url === undefined) {
        if (!(await store.saveKinds(input.spaceId, kinds)))
          throw new SpaceError("invalid", "Enregistrez d'abord l'adresse du webhook des rappels.");
        return;
      }
      const url = normalizeWebhookUrl(input.url);
      if (!url) throw new SpaceError("invalid", NOT_A_WEBHOOK);
      await store.saveReminders(input.spaceId, sealUrl(key, input.spaceId, url), kinds);
    },

    /** At an event: posts its reminder if an Admin switched the kind on. Never throws: an event never fails for it. */
    async remind(spaceId: string, kind: ReminderKind): Promise<RemindResult> {
      try {
        return await remind(spaceId, kind);
      } catch (error) {
        console.error("[Optizzz] a Discord reminder failed", error);
        return "dropped";
      }
    },
  };
}
