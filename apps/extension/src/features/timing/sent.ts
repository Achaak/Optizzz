// After the send: the exact arrival of an attack timed with the block, checked on Armee.php
// (docs/features/timing.md, « Vérification après l'envoi »).
import { storage } from "wxt/utils/storage";
import { requestDelay, verdictText, type ServerClock } from "@optizzz/game/timing";
import { withStorageLock } from "@/utils/storage-lock";
import { readSentAttacks } from "../flood/attacks";
import type { ClockIo } from "./clock";

/** An attack sent with the block on: noted at the click, before the game leaves the page. */
export interface TimedLaunch {
  target: string;
  /** The arrival the block aimed at (server time, ms). */
  aimedAt: number;
  /** The game's clock as the block measured it: when to read Armee.php. */
  clock: ServerClock;
  /** When the form was sent, on the PC's clock. */
  sentAt: number;
}

/** A timed attack the game lists, with its exact arrival. */
export interface TimedAttack {
  /** The game's number, `span#attaque_<n>`. */
  attackId: number;
  aimedAt: number;
  arrivesAt: number;
}

const QUEUE_KEY = "optizzz-timing-queue";
/** A launch the game still does not list after this was refused or cancelled. */
const FIND_WITHIN_MS = 2 * 60_000;
/** The listed attack paired with a launch arrives this close to the aimed arrival, at most. */
const PAIR_WITHIN_MS = 10 * 60_000;
/** The verdict stays on the line until this long after the arrival. */
const KEEP_AFTER_MS = 60 * 60_000;

const attacksKey = (origin: string) => `local:timing:${new URL(origin).host}:attacks` as const;

/** More cannot be sent between two page loads: anything beyond is not ours. */
const MAX_QUEUED = 20;

const isFiniteNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

/** The tab's sessionStorage is the game's page too: only what has the shape of a launch is taken. */
const isTimedLaunch = (value: unknown): value is TimedLaunch => {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  const clock = v.clock as Record<string, unknown> | null | undefined;
  return (
    typeof v.target === "string" &&
    v.target.length <= 100 &&
    isFiniteNumber(v.aimedAt) &&
    isFiniteNumber(v.sentAt) &&
    typeof clock === "object" &&
    clock !== null &&
    isFiniteNumber(clock.offsetMs) &&
    isFiniteNumber(clock.errorMs) &&
    isFiniteNumber(clock.oneWayMs)
  );
};

function readQueue(session: Storage): TimedLaunch[] {
  try {
    const parsed: unknown = JSON.parse(session.getItem(QUEUE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter(isTimedLaunch).slice(-MAX_QUEUED) : [];
  } catch {
    return [];
  }
}

const writeQueue = (session: Storage, queue: TimedLaunch[]) => {
  if (queue.length === 0) session.removeItem(QUEUE_KEY);
  else session.setItem(QUEUE_KEY, JSON.stringify(queue));
};

/** Notes the launch in the tab, synchronously: the game changes page as soon as the form is sent. */
export function queueTimedLaunch(session: Storage, launch: TimedLaunch): void {
  try {
    writeQueue(session, [...readQueue(session), launch]);
  } catch (error) {
    console.warn("[Optizzz] could not remember the timed attack", error);
  }
}

/**
 * The launches noted in the tab, found in the game's list: Armee.php is read once, timed to reach the server just after
 * a second starts, so that its `Date` header and the countdowns it holds (`reste(N)`) count from the same second and
 * `Date + N` is the exact arrival. A launch still missing two minutes after its click is forgotten.
 */
export async function checkTimedLaunches(origin: string, session: Storage, io: ClockIo): Promise<void> {
  const queue = readQueue(session);
  const latest = queue.at(-1);
  if (!latest) return;
  await io.wait(requestDelay(io.now(), latest.clock));
  const response = await io.fetch("/Armee.php", { cache: "no-store" });
  const serverDate = Date.parse(response.headers.get("date") ?? "");
  if (!response.ok || !Number.isFinite(serverDate)) return;
  const doc = new DOMParser().parseFromString(await response.text(), "text/html");
  const listed = readSentAttacks(doc, new Date(serverDate));
  const now = io.now();

  await withStorageLock(attacksKey(origin), async () => {
    const stored = (await storage.getItem<TimedAttack[]>(attacksKey(origin))) ?? [];
    const taken = new Set(stored.map((attack) => attack.attackId));
    const found: TimedAttack[] = [];
    const left = queue.filter((launch) => {
      const attack = listed
        .filter((line) => line.target.toLowerCase() === launch.target.toLowerCase() && !taken.has(line.attackId))
        .map((line) => ({ line, gap: Math.abs(line.arrivesAt.getTime() - launch.aimedAt) }))
        .filter(({ gap }) => gap <= PAIR_WITHIN_MS)
        .sort((a, b) => a.gap - b.gap)[0]?.line;
      if (attack) {
        taken.add(attack.attackId);
        found.push({ attackId: attack.attackId, aimedAt: launch.aimedAt, arrivesAt: attack.arrivesAt.getTime() });
        return false;
      }
      return now - launch.sentAt < FIND_WITHIN_MS;
    });
    // The verdicts past their date go with the write: nothing else ever removes them.
    const kept = stored.filter((attack) => attack.arrivesAt + KEEP_AFTER_MS > serverDate);
    if (found.length > 0 || kept.length < stored.length) await storage.setItem(attacksKey(origin), [...kept, ...found]);
    writeQueue(session, left);
  });
}

/** The timed attacks whose verdict is still shown (`now`: server time, ms). */
export async function loadTimedAttacks(origin: string, now: number): Promise<TimedAttack[]> {
  const stored = (await storage.getItem<TimedAttack[]>(attacksKey(origin))) ?? [];
  return stored.filter((attack) => attack.arrivesAt + KEEP_AFTER_MS > now);
}

const VERDICT = "optizzz-timing-verdict";

/**
 * « Arrivée à 23:39:59 ✓ :59 visé » on the line of each timed attack: in the row of « Attaques en cours » when that list
 * replaced the game's lines, else after the game's countdown.
 */
export function labelTimedAttacks(doc: Document, attacks: readonly TimedAttack[]): void {
  for (const attack of attacks) {
    const id = `attaque_${String(attack.attackId)}`;
    const countdown = doc.getElementById(id);
    if (!countdown) continue;
    const row = doc.querySelector(`[data-optizzz-on-way="${id}"] .optizzz-on-way-time`);
    const place = row ?? countdown.parentElement;
    if (!place || place.querySelector(`.${VERDICT}[data-attack="${id}"]`)) continue;
    const { onTime, text } = verdictText(attack.arrivesAt, attack.aimedAt);
    const label = doc.createElement("span");
    label.className = `${VERDICT} ${onTime ? "optizzz-text-success" : "optizzz-text-warning"}`;
    label.dataset.attack = id;
    label.textContent = text;
    if (row) row.append(label);
    else countdown.after(" ", label);
  }
}
