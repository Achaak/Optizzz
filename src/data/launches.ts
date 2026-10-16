// What the flood planner remembers per server: the attacks sent through the game's form, the armies pasted for
// targets, and whether the lodge counts.
import { storage } from "wxt/utils/storage";
import type { Army } from "@/game/army/units";
import { withStorageLock } from "@/utils/storage-lock";

export interface Launch {
  targetId: number;
  target: string;
  ants: number;
  /** What the attack should take when it arrives. */
  take: number;
  arrivesAt: Date;
}

interface StoredLaunch extends Omit<Launch, "arrivesAt"> {
  arrivesAt: number;
}

const host = (origin: string) => new URL(origin).host;
const launchesKey = (origin: string) => `local:flood:${host(origin)}:launches` as const;
const defensesKey = (origin: string) => `local:flood:${host(origin)}:defenses` as const;
const lodgeKey = (origin: string) => `local:flood:${host(origin)}:countLodge` as const;

const fromStored = (stored: StoredLaunch): Launch => ({ ...stored, arrivesAt: new Date(stored.arrivesAt) });

/** The attacks still on their way (the ones arrived are left out; they are dropped at the next write). */
export async function loadLaunches(origin: string, now: Date): Promise<Launch[]> {
  const stored = (await storage.getItem<StoredLaunch[]>(launchesKey(origin))) ?? [];
  return stored.filter((launch) => launch.arrivesAt > now.getTime()).map(fromStored);
}

/** The same attack, as stored by one tab and read by another. */
export const sameLaunch = (a: Launch, b: Launch) =>
  a.targetId === b.targetId &&
  a.take === b.take &&
  a.ants === b.ants &&
  a.arrivesAt.getTime() === b.arrivesAt.getTime();

/** The storage lock of a server's launches: take it around a read-modify-write, and write with `writeLaunches`. */
export const launchesLock = launchesKey;

/** Writes the launches without taking the lock: for a caller already holding `launchesLock`. */
export async function writeLaunches(origin: string, launches: Launch[]): Promise<void> {
  await storage.setItem(
    launchesKey(origin),
    launches.map((launch) => ({ ...launch, arrivesAt: launch.arrivesAt.getTime() })),
  );
}

/** Adds attacks to the ones on their way, dropping the ones arrived. */
async function recordLaunches(origin: string, launches: Launch[]): Promise<void> {
  await withStorageLock(launchesKey(origin), async () => {
    const stored = (await storage.getItem<StoredLaunch[]>(launchesKey(origin))) ?? [];
    const pending = stored.filter((launch) => launch.arrivesAt > Date.now());
    await storage.setItem(launchesKey(origin), [
      ...pending,
      ...launches.map((launch) => ({ ...launch, arrivesAt: launch.arrivesAt.getTime() })),
    ]);
  });
}

export const recordLaunch = (origin: string, launch: Launch) => recordLaunches(origin, [launch]);

// The game leaves the page as soon as the form is sent: an asynchronous write could be lost. The launch is first
// written synchronously in the tab's sessionStorage, then moved at the next page load.
const QUEUE_KEY = "optizzz-flood-queue";

/** More cannot be sent between two page loads: anything beyond is not ours. */
const MAX_QUEUED = 20;
const MAX_AHEAD = 30 * 24 * 60 * 60_000;

const isStoredLaunch = (value: unknown, now: number): value is StoredLaunch => {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    Number.isSafeInteger(v.targetId) &&
    typeof v.target === "string" &&
    v.target.length <= 100 &&
    Number.isSafeInteger(v.ants) &&
    (v.ants as number) >= 0 &&
    Number.isSafeInteger(v.take) &&
    (v.take as number) >= 0 &&
    typeof v.arrivesAt === "number" &&
    v.arrivesAt <= now + MAX_AHEAD
  );
};

const readQueue = (session: Storage): StoredLaunch[] => {
  try {
    const parsed: unknown = JSON.parse(session.getItem(QUEUE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    const now = Date.now();
    return parsed.filter((value: unknown) => isStoredLaunch(value, now)).slice(0, MAX_QUEUED);
  } catch {
    return [];
  }
};

export function queueLaunch(session: Storage, launch: Launch) {
  try {
    session.setItem(
      QUEUE_KEY,
      JSON.stringify([...readQueue(session), { ...launch, arrivesAt: launch.arrivesAt.getTime() }]),
    );
  } catch (error) {
    console.warn("[Optizzz] could not remember the attack sent", error);
  }
}

export async function flushQueuedLaunches(session: Storage, origin: string): Promise<void> {
  const queued = readQueue(session);
  if (queued.length === 0) return;
  // Removed only once stored: a duplicate is dropped at the next check of Armee.php, a lost launch is not found again.
  await recordLaunches(origin, queued.map(fromStored));
  session.removeItem(QUEUE_KEY);
}

interface StoredDefense {
  army: number[];
  readAt: number;
}

export async function loadDefense(origin: string, targetId: number): Promise<{ army: number[]; readAt: Date } | null> {
  const defenses = (await storage.getItem<Record<string, StoredDefense>>(defensesKey(origin))) ?? {};
  const defense = defenses[String(targetId)];
  return defense ? { army: defense.army, readAt: new Date(defense.readAt) } : null;
}

/** Every army remembered, by target id. */
export async function loadDefenses(origin: string): Promise<Map<number, number[]>> {
  const defenses = (await storage.getItem<Record<string, StoredDefense>>(defensesKey(origin))) ?? {};
  return new Map(Object.entries(defenses).map(([id, defense]) => [Number(id), defense.army]));
}

export async function saveDefense(origin: string, targetId: number, army: Army, readAt: Date): Promise<void> {
  const defenses = (await storage.getItem<Record<string, StoredDefense>>(defensesKey(origin))) ?? {};
  await storage.setItem(defensesKey(origin), {
    ...defenses,
    [String(targetId)]: { army: [...army], readAt: readAt.getTime() },
  });
}

export async function clearDefense(origin: string, targetId: number): Promise<void> {
  const defenses = { ...((await storage.getItem<Record<string, StoredDefense>>(defensesKey(origin))) ?? {}) };
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- a record keyed by target id
  delete defenses[String(targetId)];
  await storage.setItem(defensesKey(origin), defenses);
}

export async function loadCountLodge(origin: string): Promise<boolean> {
  return (await storage.getItem<boolean>(lodgeKey(origin))) ?? false;
}

export async function saveCountLodge(origin: string, count: boolean): Promise<void> {
  await storage.setItem(lodgeKey(origin), count);
}
