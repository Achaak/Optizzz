// What the flood planner remembers per server: the attacks sent through the game's form, the armies pasted for
// targets, and whether the lodge counts.
import { storage } from "wxt/utils/storage";
import type { Army } from "@/game/army/units";

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

/** The attacks still on their way; the ones arrived are forgotten. */
export async function loadLaunches(origin: string, now: Date): Promise<Launch[]> {
  const stored = (await storage.getItem<StoredLaunch[]>(launchesKey(origin))) ?? [];
  const pending = stored.filter((launch) => launch.arrivesAt > now.getTime());
  if (pending.length !== stored.length) await storage.setItem(launchesKey(origin), pending);
  return pending.map(fromStored);
}

/** Replaces the launches on their way, once matched with the game's list. */
export async function saveLaunches(origin: string, launches: Launch[]): Promise<void> {
  await storage.setItem(
    launchesKey(origin),
    launches.map((launch) => ({ ...launch, arrivesAt: launch.arrivesAt.getTime() })),
  );
}

export async function recordLaunch(origin: string, launch: Launch): Promise<void> {
  const stored = (await storage.getItem<StoredLaunch[]>(launchesKey(origin))) ?? [];
  await storage.setItem(launchesKey(origin), [...stored, { ...launch, arrivesAt: launch.arrivesAt.getTime() }]);
}

// The game leaves the page as soon as the form is sent: an asynchronous write could be lost. The launch is first
// written synchronously in the tab's sessionStorage, then moved at the next page load.
const QUEUE_KEY = "optizzz-flood-queue";

const readQueue = (session: Storage): StoredLaunch[] => {
  try {
    return JSON.parse(session.getItem(QUEUE_KEY) ?? "[]") as StoredLaunch[];
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
  session.removeItem(QUEUE_KEY);
  for (const launch of queued) await recordLaunch(origin, fromStored(launch));
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
