// Read-modify-write of a stored key, one at a time. The Web Locks API serializes across every tab of the page's
// origin (one game server). Where it is missing (tests), or unusable (Firefox's content scripts), a chain serializes
// within this script only.
const chains = new Map<string, Promise<unknown>>();

/**
 * Firefox's content scripts see the page's `navigator.locks` through an Xray wrapper: the page's LockManager cannot
 * read the promise our task returns, and every request rejects with « Permission denied to access property "then" ».
 * Only there does `window.wrappedJSObject` exist.
 */
const isFirefoxContentScript = () => (globalThis as { wrappedJSObject?: unknown }).wrappedJSObject !== undefined;

export function withStorageLock<T>(name: string, task: () => Promise<T>): Promise<T> {
  const locks = globalThis.navigator.locks as LockManager | null | undefined;
  if (locks && !isFirefoxContentScript()) return locks.request(`optizzz:${name}`, task);
  const run = (chains.get(name) ?? Promise.resolve()).then(task, task);
  chains.set(
    name,
    run.catch(() => undefined),
  );
  return run;
}
