// Which notifications to send now, from stored data only. See docs/features/alertes.md.
import { SOURCE_PAGES, type EndKind } from "@/game/pages/end-times";
import type { Sections } from "../end-times/recap";
import { describeProblem, problems, serverName, STALE_AFTER, type ProblemKind, type ServerData } from "./badge";

const MINUTE = 60_000;
/** Famine and full warehouses are announced this long before. */
const NOTICE_BEFORE = 60 * MINUTE;
/** Anything older was missed (browser closed): saying it now would only be noise. */
const MISSED_AFTER = 15 * MINUTE;

export type NotificationKind = "famine" | "full" | "construction" | "hunt";

/** All off unless switched on: a missing key means off. */
export type NotificationSettings = Partial<Record<NotificationKind, boolean>>;

/** Ids of the notifications already sent, with when and where a click leads. */
export type SentNotifications = Partial<Record<string, { at: number; url: string }>>;

export interface Notice {
  /** Stable for one event: the same famine is not announced twice. */
  id: string;
  message: string;
  url: string;
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

function endNotices(host: string, sections: Sections, settings: NotificationSettings, now: Date): Notice[] {
  return Object.values(sections).flatMap((section) => {
    const notice = END_NOTICES[section.kind];
    if (!notice || !settings[notice.setting]) return [];
    return section.items
      .filter((item) => item.endsAt <= now && now.getTime() - item.endsAt.getTime() <= MISSED_AFTER)
      .map((item) => ({
        id: `${host}:${section.kind}:${item.label}:${String(item.endsAt.getTime())}`,
        message: `${serverName(host)} : ${notice.describe(item.label)}`,
        url: `https://${host}${SOURCE_PAGES[section.kind]}`,
      }));
  });
}

export function dueNotifications(input: NotificationInput, now: Date): Notice[] {
  const notices = [
    ...input.servers.flatMap((data) => problemNotices(data, input.settings, input.sent, now)),
    ...Object.entries(input.ends).flatMap(([host, sections]) =>
      sections ? endNotices(host, sections, input.settings, now) : [],
    ),
  ];
  return notices.filter((notice) => !input.sent[notice.id]);
}
