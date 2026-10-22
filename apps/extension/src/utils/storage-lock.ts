// Read-modify-write of a stored key, one at a time. The Web Locks API serializes across every tab of the page's
// origin (one game server); where it is missing (tests), a chain serializes within this script only.
const chains = new Map<string, Promise<unknown>>();

export function withStorageLock<T>(name: string, task: () => Promise<T>): Promise<T> {
  const locks = globalThis.navigator.locks as LockManager | null | undefined;
  if (locks) return locks.request(`optizzz:${name}`, task);
  const run = (chains.get(name) ?? Promise.resolve()).then(task, task);
  chains.set(
    name,
    run.catch(() => undefined),
  );
  return run;
}
