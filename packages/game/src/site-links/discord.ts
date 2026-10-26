// The alliance's Discord webhook (docs/features/site-discord.md), as the space page and the extension agree on it. An
// Admin saves the webhook's address and the kinds of events that go to Discord; the record is encrypted with the Clé
// d'alliance in the Admin's browser, the site keeps it without reading it (ADR 0005, « Discord »). The detail of an
// action leaves from the extension of the member who acts, right after the matching Envoi, only for an event an Admin
// switched on and whose category the member sends (their consent). Never from the site.
import { formatNumber } from "../format/number-format";
import { formatEndTimeShort } from "../format/time-format";
import type { SentCategory } from "./envois";
import { z } from "zod";

/**
 * The kinds of events an Admin can send to Discord, each off by default. One per Envoi category that has news to
 * tell, each with its line (`discordLine`).
 */
export const DISCORD_EVENTS = ["convoys", "floods"] as const;
export type DiscordEvent = (typeof DISCORD_EVENTS)[number];

/** What the space page shows for each event. */
export const DISCORD_EVENT_LABELS: Record<DiscordEvent, { label: string; example: string }> = {
  convoys: {
    label: "Convois",
    example: "« Messor a envoyé un convoi à Lasius : 12 348 nourriture, arrivée 18 h 12 »",
  },
  floods: {
    label: "Floods",
    example: "« Messor a lancé 3 attaques sur Lasius, arrivée 18 h 12, prise attendue 12 348 »",
  },
};

/** The Envoi category a member must send for their extension to tell an event: their consent. */
const EVENT_CATEGORY: Record<DiscordEvent, SentCategory> = { convoys: "convoys", floods: "floods" };

export const eventConsented = (event: DiscordEvent, categories: readonly string[]): boolean =>
  categories.includes(EVENT_CATEGORY[event]);

/** The record an Admin saves, encrypted with the Clé d'alliance. */
export interface DiscordSettings {
  /** The webhook's address, or null when the Admin removed it. */
  url: string | null;
  events: DiscordEvent[];
  /**
   * The version of the Clé d'alliance when this address was entered: a member excluded since (a newer version) knows
   * it, and the space page offers to replace it.
   */
  urlSetAtVersion: number;
}

/** The two hosts Discord serves webhooks from, as the extension's optional host permission names them. */
const DISCORD_ORIGINS = ["https://discord.com", "https://discordapp.com"] as const;

const WEBHOOK_PATH = /^\/api\/webhooks\/(\d{1,25})\/([A-Za-z0-9_-]{1,200})\/?$/;

/**
 * A pasted Discord webhook address, written the one way the extension posts to (https://discord.com/api/webhooks/
 * <id>/<token>), or null when it is not one: another host or port, a query, a fragment, credentials, a path that goes
 * further (`/slack`, `/github`).
 */
export function normalizeWebhookUrl(text: string): string | null {
  let url: URL;
  try {
    url = new URL(text.trim());
  } catch {
    return null;
  }
  if (!(DISCORD_ORIGINS as readonly string[]).includes(url.origin)) return null;
  if (url.username || url.password || url.search || url.hash || text.trim().includes("#")) return null;
  const path = WEBHOOK_PATH.exec(url.pathname);
  if (!path) return null;
  return `https://discord.com/api/webhooks/${path[1] ?? ""}/${path[2] ?? ""}`;
}

const SETTINGS = z.object({
  v: z.literal(1),
  url: z.string().max(400).nullable(),
  events: z.array(z.string()).max(20),
  urlSetAtVersion: z.number().int().nonnegative(),
});

const isEvent = (value: string): value is DiscordEvent => (DISCORD_EVENTS as readonly string[]).includes(value);

/** The record as it is encrypted. */
export const discordSettingsText = (settings: DiscordSettings): string =>
  JSON.stringify({ v: 1, url: settings.url, events: settings.events, urlSetAtVersion: settings.urlSetAtVersion });

/**
 * The record once decrypted: events from a newer Optizzz are left out, an address that is not a Discord webhook makes
 * it refused (throws). The extension posts to nothing else.
 */
export function discordSettingsFrom(value: unknown): DiscordSettings {
  const parsed = SETTINGS.parse(value);
  const url = parsed.url === null ? null : normalizeWebhookUrl(parsed.url);
  if (parsed.url !== null && url === null) throw new Error("Not a Discord webhook address.");
  return { url, events: parsed.events.filter(isEvent), urlSetAtVersion: parsed.urlSetAtVersion };
}

/** The events that go to Discord: none without an address. */
export const sendableEvents = (settings: DiscordSettings | null): DiscordEvent[] =>
  settings?.url ? settings.events : [];

/** A convoy the member just sent. */
interface ConvoyNews {
  kind: "convoy";
  from: string;
  to: string;
  food: number;
  materials: number;
  /** The arrival, milliseconds since 1970. */
  at: number;
}

/**
 * The attacks the member just launched on one target: how many, their arrivals, and the take the Plan de flood
 * expects (what every member sees in « Floods »). Never the army sent: that is the Admins'.
 */
interface AttacksNews {
  kind: "attacks";
  from: string;
  target: string;
  count: number;
  /** The first and the last arrival, milliseconds since 1970. */
  firstAt: number;
  lastAt: number;
  /** The expected take of them all, or null when one of them was sent without the Plan de flood. */
  take: number | null;
}

/** One piece of news, as the extension of the member who acted tells it. */
export type DiscordNews = ConvoyNews | AttacksNews;

/** New attacks of one sender, one piece of news per target, in the order of their first arrival. */
export function attacksNews(
  attacks: readonly { from: string; target: string; at: number; take: number | null }[],
): DiscordNews[] {
  const byTarget = new Map<string, AttacksNews>();
  for (const attack of [...attacks].sort((a, b) => a.at - b.at)) {
    const key = attack.target.toLowerCase();
    const known = byTarget.get(key);
    if (!known) {
      byTarget.set(key, {
        kind: "attacks",
        from: attack.from,
        target: attack.target,
        count: 1,
        firstAt: attack.at,
        lastAt: attack.at,
        take: attack.take,
      });
      continue;
    }
    known.count += 1;
    known.lastAt = attack.at;
    known.take = known.take === null || attack.take === null ? null : known.take + attack.take;
  }
  return [...byTarget.values()];
}

/** Discord's markdown, escaped: a pseudo shows as written, never as formatting or a link. */
export const escapeDiscord = (text: string): string => text.replace(/[\\*_~`|>[\]()#-]/g, (c) => `\\${c}`);

/** « Messor a lancé 3 attaques sur Lasius, arrivée 18 h 12, prise attendue 12 348 », Paris time. */
function attacksLine(news: AttacksNews, now: Date): string {
  const what = news.count === 1 ? "une attaque" : `${formatNumber(news.count)} attaques`;
  const first = formatEndTimeShort(new Date(news.firstAt), now);
  const last = formatEndTimeShort(new Date(news.lastAt), now);
  const arrival = first === last ? `arrivée ${first}` : `arrivées de ${first} à ${last}`;
  const take = news.take === null ? "" : `, prise attendue ${formatNumber(news.take)}`;
  return `${escapeDiscord(news.from)} a lancé ${what} sur ${escapeDiscord(news.target)}, ${arrival}${take}`;
}

/**
 * « Messor a envoyé un convoi à Lasius : 12 348 nourriture, arrivée 18 h 12 », or the attacks' line, Paris time and
 * numbers as the game writes them.
 */
export function discordLine(news: DiscordNews, now: Date): string {
  if (news.kind === "attacks") return attacksLine(news, now);
  const amounts = [
    ...(news.food > 0 ? [`${formatNumber(news.food)} nourriture`] : []),
    ...(news.materials > 0 || news.food === 0 ? [`${formatNumber(news.materials)} matériaux`] : []),
  ].join(" et ");
  return `${escapeDiscord(news.from)} a envoyé un convoi à ${escapeDiscord(news.to)} : ${amounts}, arrivée ${formatEndTimeShort(new Date(news.at), now)}`;
}

/** Discord refuses a message longer than this. */
export const DISCORD_MESSAGE_MAX = 2000;

/** The lines in as few messages as Discord takes, one line per row; a line too long for one message is cut. */
export function discordMessages(lines: readonly string[]): string[] {
  const messages: string[] = [];
  let current = "";
  for (const raw of lines) {
    const line = raw.slice(0, DISCORD_MESSAGE_MAX);
    if (current && current.length + 1 + line.length > DISCORD_MESSAGE_MAX) {
      messages.push(current);
      current = line;
    } else current = current ? `${current}\n${line}` : line;
  }
  if (current) messages.push(current);
  return messages;
}
