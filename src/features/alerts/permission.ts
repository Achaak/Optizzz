// The optional `notifications` permission. Content scripts have no `permissions` API: they ask the background
// script, which answers or opens the extension page that asks the player (only an extension page may ask).

export const NOTIFICATIONS_PERMISSION = { permissions: ["notifications"] } satisfies Browser.permissions.Permissions;

export const GRANT_PAGE = "/notifications-permission.html";

interface PermissionMessage {
  type: "notifications-permitted" | "grant-notifications";
}

export function isPermissionMessage(message: unknown): message is PermissionMessage {
  const type = typeof message === "object" && message !== null ? (message as { type?: unknown }).type : undefined;
  return type === "notifications-permitted" || type === "grant-notifications";
}

/** From a content script. */
export async function askNotificationsPermitted(): Promise<boolean> {
  const message: PermissionMessage = { type: "notifications-permitted" };
  return (await browser.runtime.sendMessage(message)) === true;
}

/** From a content script. */
export async function askGrantPage(): Promise<void> {
  const message: PermissionMessage = { type: "grant-notifications" };
  await browser.runtime.sendMessage(message);
}

/** From an extension page or the background script. */
export function openGrantPage(): Promise<unknown> {
  return browser.tabs.create({ url: browser.runtime.getURL(GRANT_PAGE) });
}
