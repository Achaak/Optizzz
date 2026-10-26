// What the extension keeps for the alliance's Discord webhook (docs/features/site-discord.md): each space's record as
// the site hands it, still encrypted with the Clé d'alliance (only the background opens it), and what Discord last
// answered: a refusal (for the record's revision: the webhook is not tried again until an Admin saves another one) or
// a failure to show the member. Forgotten with the Clé d'alliance (« Se déconnecter »).
import { storage } from "wxt/utils/storage";

const WEBHOOKS_KEY = "local:optizzzAccount:discord";
const ANSWERS_KEY = "local:optizzzAccount:discordAnswers";

export interface KeptWebhook {
  blob: string;
  revision: number;
}

export interface DiscordAnswer {
  /** Discord refused this revision (a 4xx other than a rate limit): its HTTP status. */
  refused: { revision: number; status: number; at: number } | null;
  /** The last message that could not leave (Discord unreachable, or a 5xx), dropped. */
  failedAt: number | null;
}

const NO_ANSWER: DiscordAnswer = { refused: null, failedAt: null };

type BySpace<T> = Partial<Record<string, T>>;

export async function loadWebhook(spaceId: string): Promise<KeptWebhook | null> {
  return (await storage.getItem<BySpace<KeptWebhook>>(WEBHOOKS_KEY))?.[spaceId] ?? null;
}

/** The site's answer: every space of the account that has a webhook (the others have none any more). */
export async function storeWebhooks(rows: readonly ({ spaceId: string } & KeptWebhook)[]): Promise<void> {
  await storage.setItem<BySpace<KeptWebhook>>(
    WEBHOOKS_KEY,
    Object.fromEntries(rows.map(({ spaceId, blob, revision }) => [spaceId, { blob, revision }])),
  );
}

export async function loadDiscordAnswer(spaceId: string): Promise<DiscordAnswer> {
  return (await storage.getItem<BySpace<DiscordAnswer>>(ANSWERS_KEY))?.[spaceId] ?? NO_ANSWER;
}

export async function storeDiscordAnswer(spaceId: string, answer: DiscordAnswer): Promise<void> {
  const all = (await storage.getItem<BySpace<DiscordAnswer>>(ANSWERS_KEY)) ?? {};
  await storage.setItem(ANSWERS_KEY, { ...all, [spaceId]: answer });
}

export async function forgetWebhooks(): Promise<void> {
  await storage.removeItems([WEBHOOKS_KEY, ANSWERS_KEY]);
}
