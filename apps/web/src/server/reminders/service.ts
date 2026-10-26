import "server-only";

import { after } from "next/server";
import { env } from "~/env";
import type { ReminderKind } from "~/lib/spaces/reminders";
import { db } from "~/server/db";
import { siteOrigin } from "~/server/site-origin";
import { reminderKey } from "./at-rest";
import { prismaReminderStore } from "./prisma-store";
import { reminderService } from "./reminder-service";

const key = reminderKey(env.DISCORD_REMINDERS_KEY);
if (env.DISCORD_REMINDERS_KEY && !key)
  console.error("[Optizzz] DISCORD_REMINDERS_KEY is not 32 bytes in base64: the reminders stay off");

/** The site's reminders on Discord, on the site's database (docs/features/site-discord.md, « Rappels du site »). */
export const reminders = reminderService({
  store: prismaReminderStore(db),
  key,
  fetcher: fetch,
  origin: siteOrigin({
    nodeEnv: env.NODE_ENV,
    betterAuthUrl: env.BETTER_AUTH_URL,
    vercelEnv: env.VERCEL_ENV,
    vercelUrl: env.VERCEL_URL,
    port: env.PORT,
  }),
});

/**
 * The hook an event calls: posts the reminder after the response is sent (Next's `after`), so the action never waits
 * for Discord nor fails for it. The Demandes call `remindLater(spaceId, "demands")` when a Demande is made (it then
 * waits to be validated).
 */
export function remindLater(spaceId: string, kind: ReminderKind): void {
  const task = () => reminders.remind(spaceId, kind);
  try {
    after(task);
  } catch {
    // Outside a request (a script): at once, still without waiting.
    void task();
  }
}
