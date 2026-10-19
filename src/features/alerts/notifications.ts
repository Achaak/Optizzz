// Which notifications to send now, from stored data only. See docs/features/alertes.md.
import { ATTACK_LABEL, SOURCE_PAGES, type EndItem, type EndKind } from "@/game/pages/end-times";
import type { Sections } from "../end-times/recap";
import { describeProblem, problems, serverName, STALE_AFTER, type ProblemKind, type ServerData } from "./badge";

const MINUTE = 60_000;
/** Famine and full warehouses are announced this long before. */
const NOTICE_BEFORE = 60 * MINUTE;
/** Anything older was missed (browser closed): saying it now would only be noise. */
const MISSED_AFTER = 15 * MINUTE;

import type { WatchNotificationKind } from "../watchlist/describe";

export type NotificationKind = "famine" | "full" | "construction" | "hunt" | "attack" | WatchNotificationKind;

/** All off unless switched on: a missing key means off. */
export type NotificationSettings = Partial<Record<NotificationKind, boolean>>;

/** Ids of the notifications already sent, with when and where a click leads. */
export type SentNotifications = Partial<Record<string, { at: number; url: string }>>;

export interface Notice {
  /** Stable for one event: the same famine is not announced twice. */
  id: string;
  message: string;
  url: string;
  /** Other events this notice sums up (attacks landing together): remembered as sent with it. */
  covers?: string[];
}

export interface NotificationInput {
  servers: ServerData[];
  /** End times stored by « Heures de fin », by host. */
  ends: Partial<Record<string, Sections>>;
  settings: NotificationSettings;
  sent: SentNotifications;
}

const PROBLEM_SETTING: Record<ProblemKind, NotificationKind> = {
  famine: "famine",
  foodFull: "full",
  materialsFull: "full",
};

const SLOT = 15 * MINUTE;
/** The same problem moved by less than this is the same event: it is not announced again. */
const SAME_EVENT_SLOTS = 2;

/** Whether a problem of this kind, foreseen within half an hour of `slot`, was already announced. */
const alreadySent = (sent: SentNotifications, host: string, kind: ProblemKind, slot: number) =>
  Object.keys(sent).some((id) => {
    const [sentHost, sentKind, sentSlot] = id.split(":");
    return sentHost === host && sentKind === kind && Math.abs(Number(sentSlot) - slot) <= SAME_EVENT_SLOTS;
  });

function problemNotices(
  data: ServerData,
  settings: NotificationSettings,
  sent: SentNotifications,
  now: Date,
): Notice[] {
  const { income } = data;
  if (!income) return [];
  const age = (date: Date) => now.getTime() - date.getTime();
  if (Math.max(age(data.stock.readAt), age(income.readAt)) > STALE_AFTER) return [];
  return problems(data, income).flatMap(({ kind, at }) => {
    const left = at.getTime() - now.getTime();
    if (!settings[PROBLEM_SETTING[kind]] || left > NOTICE_BEFORE || left < -MISSED_AFTER) return [];
    // Rounded: the forecast moves a little from one page to the next.
    const slot = Math.round(at.getTime() / SLOT);
    if (alreadySent(sent, data.host, kind, slot)) return [];
    return [
      {
        id: `${data.host}:${kind}:${String(slot)}`,
        message: `${serverName(data.host)} : ${describeProblem(kind, at, now)}`,
        url: `https://${data.host}/Ressources.php`,
      },
    ];
  });
}

/** End times worth a notification, with their setting and wording. Layings and convoys are not. */
const END_NOTICES: Partial<Record<EndKind, { setting: NotificationKind; describe: (label: string) => string }>> = {
  construction: { setting: "construction", describe: (label) => `chantier terminé · ${label}` },
  research: { setting: "construction", describe: (label) => `chantier terminé · ${label}` },
  // « Chasse 183 cm² » → « chasse rentrée · 183 cm² ».
  hunt: { setting: "hunt", describe: (label) => `chasse rentrée · ${label.replace(/^Chasse\s+/, "")}` },
};

const ended = (now: Date) => (item: EndItem) =>
  item.endsAt <= now && now.getTime() - item.endsAt.getTime() <= MISSED_AFTER;

const endId = (host: string, kind: EndKind, item: EndItem) =>
  `${host}:${kind}:${item.label}:${String(item.endsAt.getTime())}`;

function endNotices(host: string, sections: Sections, input: NotificationInput, now: Date): Notice[] {
  return Object.values(sections).flatMap((section) => {
    if (section.kind === "attack") return attackNotices(host, section.items, input, now);
    const notice = END_NOTICES[section.kind];
    if (!notice || !input.settings[notice.setting]) return [];
    return section.items.filter(ended(now)).map((item) => ({
      id: endId(host, section.kind, item),
      message: `${serverName(host)} : ${notice.describe(item.label)}`,
      url: `https://${host}${SOURCE_PAGES[section.kind]}`,
    }));
  });
}

/**
 * The attacks arrived since the last notification, in one notice: a flood lands a dozen attacks within seconds.
 * « S5 : attaque arrivée · Cible_1 », « S5 : 3 attaques arrivées · Cible_1 (2), Cible_2 ».
 */
function attackNotices(host: string, items: readonly EndItem[], input: NotificationInput, now: Date): Notice[] {
  if (!input.settings.attack) return [];
  const arrived = items
    .filter(ended(now))
    .map((item) => ({ id: endId(host, "attack", item), target: item.label.slice(ATTACK_LABEL.length) }))
    .filter((attack) => !input.sent[attack.id]);
  const [first, ...others] = arrived;
  if (!first) return [];
  const counts = new Map<string, number>();
  for (const { target } of arrived) counts.set(target, (counts.get(target) ?? 0) + 1);
  const targets = [...counts].map(([target, count]) => (count > 1 ? `${target} (${String(count)})` : target));
  const what = arrived.length > 1 ? `${String(arrived.length)} attaques arrivées` : "attaque arrivée";
  return [
    {
      id: first.id,
      message: `${serverName(host)} : ${what} · ${targets.join(", ")}`,
      url: `https://${host}${SOURCE_PAGES.attack}`,
      ...(others.length > 0 && { covers: others.map((attack) => attack.id) }),
    },
  ];
}

export function dueNotifications(input: NotificationInput, now: Date): Notice[] {
  const notices = [
    ...input.servers.flatMap((data) => problemNotices(data, input.settings, input.sent, now)),
    ...Object.entries(input.ends).flatMap(([host, sections]) =>
      sections ? endNotices(host, sections, input, now) : [],
    ),
  ];
  return notices.filter((notice) => !input.sent[notice.id]);
}

/**
 * Shows each notice with `show` and returns `sent` with the ones shown: one that fails is logged and left out,
 * to be tried again next time, without stopping the others.
 */
export async function deliverNotices(
  notices: readonly Notice[],
  sent: SentNotifications,
  now: Date,
  show: (notice: Notice) => Promise<unknown>,
): Promise<SentNotifications> {
  const updated = { ...sent };
  for (const notice of notices) {
    try {
      await show(notice);
      for (const id of [notice.id, ...(notice.covers ?? [])]) updated[id] = { at: now.getTime(), url: notice.url };
    } catch (error) {
      console.warn("[Optizzz] could not show a notification", error);
    }
  }
  return updated;
}
