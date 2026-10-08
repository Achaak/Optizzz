// The toolbar badge, kept up to date by the background script from stored data only.
import { storage } from "wxt/utils/storage";
import { isEnabled, loadToggles, TOGGLES_KEY } from "../toggles";
import { badge, type Badge } from "./badge";
import { loadServers, STOCKS_KEY } from "./store";

const ALARM = "alerts-badge";

const COLORS: Record<NonNullable<Badge["color"]>, string> = {
  red: "#c00000",
  orange: "#e07000",
  gray: "#808080",
};

async function refreshBadge(): Promise<void> {
  const shown = isEnabled(await loadToggles(), "alerts", "badge")
    ? badge(await loadServers(), new Date())
    : { text: "", color: null, title: "Optizzz" };
  await browser.action.setBadgeText({ text: shown.text });
  if (shown.color) await browser.action.setBadgeBackgroundColor({ color: COLORS[shown.color] });
  await browser.action.setTitle({ title: shown.title });
}

function refresh() {
  refreshBadge().catch((error: unknown) => {
    console.error("[Optizzz] could not update the badge", error);
  });
}

/** Every minute (the countdown moves), and as soon as a page stores a new stock or a switch changes. */
export function setUpBadge(): void {
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM) refresh();
  });
  void browser.alarms.get(ALARM).then((alarm) => {
    if (!alarm) void browser.alarms.create(ALARM, { periodInMinutes: 1 });
  });
  storage.watch(STOCKS_KEY, refresh);
  storage.watch(TOGGLES_KEY, refresh);
  refresh();
}
