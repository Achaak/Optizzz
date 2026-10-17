// Every hour, a reading of the exports for each server's watch list, and the notification summing it up. The one
// background task that downloads: the public exports, never a game page — see docs/features/suivis.md.
import { loadNotificationSettings } from "@/features/alerts/notification-settings";
import { sendNotice } from "@/features/alerts/background";
import { isEnabled, loadToggles } from "@/features/toggles";
import { watchedHosts, type WatchKey } from "@/data/watchlist";
import { watchNotice } from "./describe";
import { originOf, takeReading, type Reading } from "./reading";
import { loadLossPercent, watchlistPageUrl } from "./settings";

const ALARM = "watchlist";
/** The exports come out every hour. */
const PERIOD_MINUTES = 60;

const serverName = (host: string) => (host.split(".")[0] ?? host).toUpperCase();

async function notify(host: string, reading: Reading): Promise<void> {
  const names: Partial<Record<WatchKey, string>> = {};
  for (const [key, player] of Object.entries(reading.state.players)) names[key as WatchKey] = player?.pseudo;
  for (const [key, alliance] of Object.entries(reading.state.alliances)) names[key as WatchKey] = alliance?.tag;
  const message = watchNotice({
    server: serverName(host),
    journal: reading.fresh,
    losses: reading.losses,
    names,
    enabled: await loadNotificationSettings(),
    lossPercent: await loadLossPercent(),
  });
  if (!message) return;
  await sendNotice({
    id: `watch:${host}:${reading.state.version}`,
    message,
    url: watchlistPageUrl(await originOf(host)),
  });
}

async function readAll(only?: string): Promise<void> {
  if (!isEnabled(await loadToggles(), "watchlist")) return;
  const now = new Date();
  for (const host of only ? [only] : await watchedHosts()) {
    try {
      const reading = await takeReading(host, now);
      if (reading) await notify(host, reading);
    } catch (error) {
      console.warn(`[Optizzz] watch list: reading ${host} failed`, error);
    }
  }
}

// One reading at a time: two at once would both diff against the same state and note the changes twice.
let running: Promise<void> = Promise.resolve();

function read(only?: string) {
  running = running.then(() => readAll(only));
}

export function setUpWatchlist(): void {
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM) read();
  });
  void browser.alarms.get(ALARM).then((alarm) => {
    if (!alarm) void browser.alarms.create(ALARM, { periodInMinutes: PERIOD_MINUTES, delayInMinutes: 1 });
  });
  // A list changed (an entry added here or on another device): its first state is read at once.
  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    for (const key of Object.keys(changes)) if (key.startsWith("watchlist:")) read(key.slice("watchlist:".length));
  });
  read();
}
