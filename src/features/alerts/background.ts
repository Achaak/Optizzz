// The toolbar badge and the notifications, kept up to date by the background script from stored data only.
import { storage } from "wxt/utils/storage";
import { loadSections } from "@/data/end-times";
import { isEnabled, loadToggles, TOGGLES_KEY, type Toggles } from "../toggles";
import { badge, type Badge, type ServerData } from "./badge";
import { loadNotificationSettings } from "./notification-settings";
import { dueNotifications, type SentNotifications } from "./notifications";
import { isPermissionMessage, NOTIFICATIONS_PERMISSION, openGrantPage } from "./permission";
import { loadServers, STOCKS_KEY } from "./store";
import { URGENCY_COLORS } from "@/utils/urgency";

const ALARM = "alerts-badge";
const SENT_KEY = "local:alerts:sentNotifications";
/** Sent notifications are remembered this long: past it, the same event cannot come back. */
const SENT_KEPT = 2 * 24 * 60 * 60_000;

const COLORS: Record<NonNullable<Badge["color"]>, string> = {
  red: URGENCY_COLORS.danger,
  orange: URGENCY_COLORS.warning,
  gray: "#808080",
};

async function refreshBadge(toggles: Toggles, servers: ServerData[], now: Date): Promise<void> {
  const shown = isEnabled(toggles, "alerts", "badge")
    ? badge(servers, now)
    : { text: "", color: null, title: "Optizzz" };
  await browser.action.setBadgeText({ text: shown.text });
  if (shown.color) await browser.action.setBadgeBackgroundColor({ color: COLORS[shown.color] });
  await browser.action.setTitle({ title: shown.title });
}

async function sendNotifications(toggles: Toggles, servers: ServerData[], now: Date): Promise<void> {
  if (!isEnabled(toggles, "alerts", "notifications")) return;
  const settings = await loadNotificationSettings();
  if (!Object.values(settings).some(Boolean)) return;
  if (!(await browser.permissions.contains(NOTIFICATIONS_PERMISSION))) return;

  const ends = Object.fromEntries(
    await Promise.all(servers.map(async (data) => [data.host, await loadSections(`https://${data.host}`)] as const)),
  );
  const stored = (await storage.getItem<SentNotifications>(SENT_KEY)) ?? {};
  const sent = Object.fromEntries(
    Object.entries(stored).filter(([, entry]) => entry && now.getTime() - entry.at < SENT_KEPT),
  );
  const notices = dueNotifications({ servers, ends, settings, sent }, now);
  for (const notice of notices) {
    await browser.notifications.create(notice.id, {
      type: "basic",
      iconUrl: browser.runtime.getURL("/icons/128.png"),
      title: "Optizzz",
      message: notice.message,
    });
    sent[notice.id] = { at: now.getTime(), url: notice.url };
  }
  await storage.setItem(SENT_KEY, sent);
}

async function update(): Promise<void> {
  const [toggles, servers] = await Promise.all([loadToggles(), loadServers()]);
  const now = new Date();
  await refreshBadge(toggles, servers, now);
  await sendNotifications(toggles, servers, now);
}

// One update at a time: two at once would read the same « sent » list and notify the same event twice.
let running: Promise<void> = Promise.resolve();
let queued = false;

function refresh() {
  if (queued) return;
  queued = true;
  running = running.then(async () => {
    queued = false;
    await update().catch((error: unknown) => {
      console.error("[Optizzz] could not update the alerts", error);
    });
  });
}

/** A click on a notification opens the game page it is about. */
async function openNotified(id: string): Promise<void> {
  const sent = (await storage.getItem<SentNotifications>(SENT_KEY)) ?? {};
  const url = sent[id]?.url;
  if (url) await browser.tabs.create({ url });
  await browser.notifications.clear(id);
}

let listeningToClicks = false;

/** `browser.notifications` only exists once the optional permission is granted. */
function listenToClicks() {
  if (listeningToClicks || !("notifications" in browser)) return;
  listeningToClicks = true;
  browser.notifications.onClicked.addListener((id) => {
    openNotified(id).catch((error: unknown) => {
      console.error("[Optizzz] could not open the notified page", error);
    });
  });
}

/**
 * Every minute (the countdown moves), and as soon as a page stores a new stock or a switch changes.
 * Also answers the content scripts about the notifications permission, which they cannot query.
 */
export function setUpAlerts(): void {
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM) refresh();
  });
  void browser.alarms.get(ALARM).then((alarm) => {
    if (!alarm) void browser.alarms.create(ALARM, { periodInMinutes: 1 });
  });
  storage.watch(STOCKS_KEY, refresh);
  storage.watch(TOGGLES_KEY, refresh);

  listenToClicks();
  browser.permissions.onAdded.addListener(() => {
    listenToClicks();
    refresh();
  });

  // Answered through sendResponse: Chrome ignores a promise returned by the listener.
  browser.runtime.onMessage.addListener((message: unknown, _sender, sendResponse: (answer: unknown) => void) => {
    if (!isPermissionMessage(message)) return false;
    const answer =
      message.type === "notifications-permitted"
        ? browser.permissions.contains(NOTIFICATIONS_PERMISSION)
        : openGrantPage().then(() => null);
    answer.then(sendResponse, (error: unknown) => {
      console.error("[Optizzz] could not answer about the notifications permission", error);
      sendResponse(null);
    });
    return true;
  });
  refresh();
}
