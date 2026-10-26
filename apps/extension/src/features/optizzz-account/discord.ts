// The alliance's Discord webhook in the background script (docs/features/site-discord.md, ADR 0005 « Discord »). The
// site hands the record still encrypted with the Clé d'alliance; the background opens it and, right after an Envoi,
// posts the news of the member who acted: only for an event an Admin switched on, whose category the member sends
// (their consent), once the member allowed the extension to write to discord.com (optional permission, asked on a
// click). Never from the site, never from a timer: the only delay is the one Discord asks for after a rate limit.
//
// Generic: an Envoi tells `announce` its event (DISCORD_EVENTS) and its news (DiscordNews); the floods plug in there.
import { formatPastTime } from "@optizzz/game/format/time-format";
import {
  discordLine,
  discordMessages,
  discordSettingsFrom,
  eventConsented,
  sendableEvents,
  type DiscordEvent,
  type DiscordNews,
  type DiscordSettings,
} from "@optizzz/game/site-links/discord";
import type { EnvoiCrypto } from "@optizzz/game/site-links/envois";
import { forgetWebhooks, loadDiscordAnswer, loadWebhook, storeDiscordAnswer, storeWebhooks } from "@/data/discord";
import { siteApi } from "./api";

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

interface Dependencies {
  now: () => Date;
  fetch: Fetch;
  /** https://discord.com/api/webhooks/* granted (and, on Firefox, the consent to send what the game showed). */
  permitted: () => Promise<boolean>;
  /** The one wait Discord asks for after a rate limit (setTimeout): never a periodic send. */
  later: (ms: number, run: () => void) => void;
}

/** What « Compte Optizzz » says of Discord for a Joueur. */
export interface DiscordStatus {
  /** The events an Admin switched on, and whether this Joueur sends their category. */
  events: { event: DiscordEvent; label: string; consented: boolean }[];
  permitted: boolean;
  problem: string | null;
}

const LABELS: Record<DiscordEvent, string> = { convoys: "convois", floods: "floods" };

const TIMEOUT_MS = 15_000;
/** At most this many lines wait during a rate limit: older ones are dropped rather than flooding the channel later. */
const MAX_WAITING = 50;
/** Discord rarely asks for more than a few seconds; a longer wait drops what waited. */
const LONGEST_WAIT_MS = 10 * 60_000;

const REFUSED =
  "Discord a refusé le dernier message : le webhook de l'alliance n'est plus valable. Les Admins de l'espace le voient sur optizzz.fr.";
const failed = (at: Date, now: Date) =>
  `Discord n'a pas répondu ${formatPastTime(at, now)} : ce message n'y est pas parti.`;

interface Queue {
  spaceId: string;
  revision: number;
  token: string;
  lines: string[];
  /** A send or a wait is under way: new lines join the queue and leave with it. */
  busy: boolean;
}

/** How long Discord asks to wait after a 429, in milliseconds: its `retry_after` (seconds), or Retry-After. */
async function retryAfter(response: Response): Promise<number> {
  const body: unknown = await response.json().catch(() => null);
  const seconds =
    typeof body === "object" && body !== null && typeof (body as { retry_after?: unknown }).retry_after === "number"
      ? (body as { retry_after: number }).retry_after
      : Number(response.headers.get("retry-after"));
  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds * 1000) : 1000;
}

export function discordService({ now, fetch, permitted, later }: Dependencies) {
  const queues = new Map<string, Queue>();

  /** The site's answer about the account's spaces: each one's webhook, still encrypted. */
  async function refresh(token: string): Promise<void> {
    const answer = await siteApi(token, fetch).discord();
    if (answer.ok) await storeWebhooks(answer.value.spaces);
  }

  async function open(spaceId: string, crypto: EnvoiCrypto) {
    const kept = await loadWebhook(spaceId);
    if (!kept) return null;
    let settings: DiscordSettings;
    try {
      settings = discordSettingsFrom(JSON.parse(await crypto.decrypt(kept.blob)));
    } catch {
      // Another version than those held, or not a Discord webhook: nothing is posted.
      return null;
    }
    return { revision: kept.revision, settings };
  }

  async function post(url: string, content: string): Promise<Response | null> {
    try {
      return await fetch(url, {
        method: "POST",
        credentials: "omit",
        headers: { "content-type": "application/json" },
        // Never a mention: a pseudo or a word of the game cannot ping the channel.
        body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      return null;
    }
  }

  /** Sends what waits for a webhook, one message after the other, and stops at the first answer that is not a 2xx. */
  async function flush(url: string, queue: Queue): Promise<void> {
    while (queue.lines.length > 0) {
      const [content = ""] = discordMessages(queue.lines);
      const response = await post(url, content);
      if (response?.status === 429) {
        const wait = await retryAfter(response);
        if (wait > LONGEST_WAIT_MS) {
          queue.lines = [];
          break;
        }
        later(wait, () => {
          void flush(url, queue).catch((error: unknown) => {
            console.error("[Optizzz] Discord: the waiting messages could not be sent", error);
          });
        });
        return;
      }
      const answer = await loadDiscordAnswer(queue.spaceId);
      if (response?.ok) {
        // The lines of this message leave the queue.
        queue.lines = queue.lines.slice(content.split("\n").length);
        if (answer.failedAt !== null || answer.refused !== null)
          await storeDiscordAnswer(queue.spaceId, { refused: null, failedAt: null });
        continue;
      }
      queue.lines = [];
      if (response && response.status >= 400 && response.status < 500) {
        await storeDiscordAnswer(queue.spaceId, {
          ...answer,
          refused: { revision: queue.revision, status: response.status, at: now().getTime() },
        });
        // For the Admins' « Discord a refusé le dernier message »: the status only.
        await siteApi(queue.token, fetch).reportDiscordRefusal(queue.spaceId, queue.revision, response.status);
      } else await storeDiscordAnswer(queue.spaceId, { ...answer, failedAt: now().getTime() });
    }
    queue.busy = false;
  }

  /**
   * Right after an Envoi: the member's news of one event, posted if an Admin switched the event on, the member sends
   * its category, and the extension may write to discord.com. Never throws: Discord never blocks the player's action.
   */
  async function announce(input: {
    token: string;
    spaceId: string;
    categories: readonly string[];
    crypto: EnvoiCrypto;
    event: DiscordEvent;
    news: readonly DiscordNews[];
  }): Promise<void> {
    if (input.news.length === 0 || !eventConsented(input.event, input.categories)) return;
    const opened = await open(input.spaceId, input.crypto);
    const url = opened?.settings.url;
    if (!opened || !url || !sendableEvents(opened.settings).includes(input.event)) return;
    if ((await loadDiscordAnswer(input.spaceId)).refused?.revision === opened.revision) return;
    if (!(await permitted())) return;

    const at = now();
    const lines = input.news.map((news) => discordLine(news, at));
    const known = queues.get(url);
    const queue: Queue = known ?? {
      spaceId: input.spaceId,
      revision: opened.revision,
      token: input.token,
      lines: [],
      busy: false,
    };
    Object.assign(queue, { spaceId: input.spaceId, revision: opened.revision, token: input.token });
    queue.lines = [...queue.lines, ...lines].slice(-MAX_WAITING);
    queues.set(url, queue);
    if (queue.busy) return;
    queue.busy = true;
    await flush(url, queue).catch((error: unknown) => {
      queue.busy = false;
      console.error("[Optizzz] Discord: the message could not be sent", error);
    });
  }

  /** For « Compte Optizzz »: what goes to Discord for this Joueur, or null when the space announces nothing. */
  async function status(input: {
    spaceId: string;
    categories: readonly string[];
    crypto: EnvoiCrypto;
  }): Promise<DiscordStatus | null> {
    const opened = await open(input.spaceId, input.crypto);
    const events = sendableEvents(opened?.settings ?? null);
    if (!opened || events.length === 0) return null;
    const answer = await loadDiscordAnswer(input.spaceId);
    const at = now();
    return {
      events: events.map((event) => ({
        event,
        label: LABELS[event],
        consented: eventConsented(event, input.categories),
      })),
      permitted: await permitted(),
      problem:
        answer.refused?.revision === opened.revision
          ? REFUSED
          : answer.failedAt !== null
            ? failed(new Date(answer.failedAt), at)
            : null,
    };
  }

  return {
    refresh,
    announce,
    status,
    forget: forgetWebhooks,
    /** Forgets what waits (tests, and a new background). */
    reset: () => queues.clear(),
  };
}

export type DiscordService = ReturnType<typeof discordService>;
