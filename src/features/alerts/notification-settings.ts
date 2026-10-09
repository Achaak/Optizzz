// Which notifications the player switched on: global (not per server) and synced, like the feature toggles.
import { storage } from "wxt/utils/storage";
import type { NotificationKind, NotificationSettings } from "./notifications";

export const NOTIFICATIONS_KEY = "sync:alertNotifications";

export async function loadNotificationSettings(): Promise<NotificationSettings> {
  return (await storage.getItem<NotificationSettings>(NOTIFICATIONS_KEY)) ?? {};
}

// Read-modify-write: two quick clicks must not both read the old state, or the second write drops the first.
let pendingWrite: Promise<void> = Promise.resolve();

export function setNotification(kind: NotificationKind, enabled: boolean): Promise<void> {
  const write = pendingWrite.then(async () => {
    await storage.setItem(NOTIFICATIONS_KEY, { ...(await loadNotificationSettings()), [kind]: enabled });
  });
  pendingWrite = write.catch(() => undefined);
  return write;
}
