// The watched entries' changes in the player's words, and the notification summing up one reading.
import { versionDate } from "@/data/export-history";
import type { WatchKey } from "@/data/watchlist";
import { formatDecimal } from "@optizzz/game/format/number-format";
import { formatPastTime } from "@optizzz/game/format/time-format";
import type { Change, JournalEntry } from "./changes";

/** « de Rival », « d'Arrivant »: French elides « de » before a vowel or a mute h. */
const of = (name: string) => (/^[aeiouyhàâäéèêëîïôöùûü]/i.test(name) ? `d'${name}` : `de ${name}`);

/** « a quitté ABC pour XYZ », « XYZ lui a déclaré la guerre »: what follows the entry's name. */
export function describeChange(change: Change): string {
  switch (change.kind) {
    case "alliance":
      if (change.from === null) return `a rejoint ${change.to ?? ""}`;
      if (change.to === null) return `a quitté ${change.from}`;
      return `a quitté ${change.from} pour ${change.to}`;
    case "holiday":
      return change.on ? "en vacances" : "de retour de vacances";
    case "banned":
      return "compte banni";
    case "gone":
      return "n'existe plus";
    case "joined":
      return `arrivée ${of(change.pseudo)}`;
    case "left":
      return `départ ${of(change.pseudo)}`;
    case "war":
      return change.declaredBy === "it"
        ? `a déclaré la guerre à ${change.tag}`
        : `${change.tag} lui a déclaré la guerre`;
    case "war-ended":
      return `plus en guerre avec ${change.tag}`;
    case "pact":
      return `nouveau pacte (${change.name}) avec ${change.tag}`;
    case "pact-ended":
      return `pacte (${change.name}) rompu avec ${change.tag}`;
  }
}

/** Readings an hour apart: the change is dated by the second one. Further apart, the browser was closed. */
const NEXT_READING_MS = 70 * 60_000;

/** « aujourd'hui 13 h 00 », or « entre hier 22 h 00 et aujourd'hui 8 h 00 ». */
export function describeWhen({ since, until }: Pick<JournalEntry, "since" | "until">, now: Date): string {
  const from = versionDate(since);
  const to = versionDate(until);
  if (to.getTime() - from.getTime() <= NEXT_READING_MS) return formatPastTime(to, now);
  const first = formatPastTime(from, now);
  const last = formatPastTime(to, now);
  // The same day said once: « aujourd'hui entre 0 h 00 et 8 h 00 ».
  const day = (text: string) => text.replace(/\s*\d+ h \d{2}$/, "");
  if (day(first) === day(last))
    return `${day(first)} entre ${first.slice(day(first).length).trim()} et ${last.slice(day(last).length).trim()}`;
  return `entre ${first} et ${last}`;
}

/** Each kind of notification the watch list can send; all off by default. */
export type WatchNotificationKind =
  "watch-field" | "watch-alliance" | "watch-holiday" | "watch-war" | "watch-pact" | "watch-members";

const NOTIFIED: Partial<Record<Change["kind"], WatchNotificationKind>> = {
  alliance: "watch-alliance",
  holiday: "watch-holiday",
  war: "watch-war",
  "pact-ended": "watch-pact",
  joined: "watch-members",
  left: "watch-members",
};

/** Lost field notified from this percent, unless the player chose another. */
export const DEFAULT_LOSS_PERCENT = 20;

/** Past this many changes, the notification counts the rest. */
const MAX_PARTS = 4;

export interface WatchNoticeInput {
  /** « S5 ». */
  server: string;
  journal: readonly JournalEntry[];
  losses: readonly { key: WatchKey; name: string; percent: number }[];
  /** Names of the watched entries, by key. */
  names: Partial<Record<WatchKey, string>>;
  enabled: Partial<Record<WatchNotificationKind, boolean>>;
  lossPercent: number;
}

/** « Suivis S5 : Rival −32 % de TDC · ABC : XYZ lui a déclaré la guerre »; null when nothing switched on happened. */
export function watchNotice({ server, journal, losses, names, enabled, lossPercent }: WatchNoticeInput): string | null {
  const parts: string[] = [];
  if (enabled["watch-field"])
    for (const loss of losses)
      if (loss.percent >= lossPercent) parts.push(`${loss.name} −${formatDecimal(loss.percent, 0)} % de TDC`);
  for (const noted of journal) {
    const kind = NOTIFIED[noted.change.kind];
    if (kind && enabled[kind]) parts.push(`${names[noted.key] ?? ""} : ${describeChange(noted.change)}`);
  }
  if (parts.length === 0) return null;
  const shown = parts.slice(0, MAX_PARTS);
  const more = parts.length - shown.length;
  return `Suivis ${server} : ${shown.join(" · ")}${more > 0 ? ` · et ${String(more)} de plus` : ""}`;
}
