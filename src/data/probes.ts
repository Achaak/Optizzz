// Putting the probes in place with the « Déplacer son armée » form of Armee.php (docs/research/fourmizzz-pages.md),
// on the player's click or right after a hunt or an attack they sent. See docs/features/sondes.md.
import { storage } from "wxt/utils/storage";
import type { Place } from "@/game/army/battle";
import { armyFromKeys, UNITS } from "@/game/army/units";
import { PLACES, placesWithoutProbe, probeMoves, storeMoves, type ProbeMove, type ProbePlan } from "@/game/probes";
import { readGarrison } from "./garrison";

/** What the player wants on each place, by unit key; stored per server. */
export type ProbeTargets = Record<Place, Record<string, number>>;

export const DEFAULT_PROBE_TARGETS: ProbeTargets = { field: { JSN: 1 }, nest: { JSN: 1 }, lodge: { JSN: 1 } };

const targetsKey = (host: string) => `local:probes:${host}:targets` as const;

export async function loadProbeTargets(host: string): Promise<ProbeTargets> {
  return { ...DEFAULT_PROBE_TARGETS, ...(await storage.getItem<Partial<ProbeTargets>>(targetsKey(host))) };
}

export async function saveProbeTargets(host: string, targets: ProbeTargets): Promise<void> {
  await storage.setItem(targetsKey(host), targets);
}

/** The targets of the watched places. */
export const probePlan = (targets: ProbeTargets, watched: readonly Place[]): ProbePlan =>
  Object.fromEntries(
    PLACES.filter((place) => watched.includes(place)).map((place) => [place, armyFromKeys(targets[place])]),
  );

const LIEU: Record<Place, string> = { field: "1", nest: "2", lodge: "3" };

export interface MoveForm {
  /** Hidden inputs (token…) to post back as they are. */
  hiddenFields: Record<string, string>;
  submit: { name: string; value: string };
}

/**
 * The « Déplacer son armée » form; null on another page. Read in its whole table: the game opens the `<form>` in a
 * cell, the parser closes it there, and the radios and the submit button end up outside it.
 */
export function readMoveForm(doc: Document): MoveForm | null {
  const table = doc.querySelector('input[name="LieuOrigine"]')?.closest("table");
  const submit = table?.querySelector<HTMLInputElement>('input[type="submit"][name]');
  if (!table || !submit) return null;
  const hiddenFields = Object.fromEntries(
    [...table.querySelectorAll<HTMLInputElement>('input[type="hidden"][name]')].map((input) => [
      input.name,
      input.value,
    ]),
  );
  return { hiddenFields, submit: { name: submit.name, value: submit.value } };
}

export interface ProbesResult {
  placed: Place[];
  /** Watched places still without a probe. */
  missing: Place[];
  /** The game did not take a move, or Armee.php could not be read. */
  failed: boolean;
}

type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

interface MoveOptions {
  fetchFn?: FetchFn;
  wait?: (ms: number) => Promise<void>;
}

/** Between two moves, as between two layings or two hunts: sent back to back, the game dropped some (2026-10-21). */
const DELAY_MS = 1000;
/** A move the game did not take is sent once more, from a fresh page, before giving up. */
const ATTEMPTS = 2;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const parse = async (response: Response) => new DOMParser().parseFromString(await response.text(), "text/html");

function moveBody(form: MoveForm, move: ProbeMove): string {
  const body = new URLSearchParams(form.hiddenFields);
  body.set("nbTroupes", String(move.count));
  body.set("ChoixUnite", `unite${String(UNITS[move.unit]?.field ?? 0)}`);
  body.set("LieuOrigine", LIEU[move.from]);
  body.set("LieuDestination", LIEU[move.to]);
  body.set(form.submit.name, form.submit.value);
  return body.toString();
}

type MovePlanner = typeof probeMoves;

/** Brings each watched place up to its probes, one move after the other, reading Armee.php afresh each time. */
export const placeProbes = (origin: string, plan: ProbePlan, options?: MoveOptions) =>
  applyMoves(origin, plan, probeMoves, options);

/** « Replacer l'armée »: every ant in the Loge but the probes of the other places, as `placeProbes` does. */
export const storeArmy = (origin: string, plan: ProbePlan, options?: MoveOptions) =>
  applyMoves(origin, plan, storeMoves, options);

async function applyMoves(
  origin: string,
  plan: ProbePlan,
  planMoves: MovePlanner,
  { fetchFn = (url, init) => fetch(url, init), wait = sleep }: MoveOptions = {},
): Promise<ProbesResult> {
  const url = `${origin}/Armee.php`;
  const placed: Place[] = [];
  let sent: { move: ProbeMove; before: number } | null = null;
  let failures = 0;
  // A bounded number of moves: never a loop if the game keeps answering the same page.
  for (let step = 0; step <= PLACES.length * UNITS.length + ATTEMPTS; step++) {
    if (sent) await wait(DELAY_MS);
    // Every move from a fresh page: the token of the moment, and the garrison that tells whether the last move went.
    const doc = await parse(await fetchFn(url));
    const garrison = readGarrison(doc);
    if (!garrison) return { placed, missing: PLACES.filter((place) => plan[place]), failed: true };
    if (sent) {
      const { move, before } = sent;
      if ((garrison.armies[move.to][move.unit] ?? 0) >= before + move.count) {
        failures = 0;
        if (!placed.includes(move.to)) placed.push(move.to);
      } else if (++failures >= ATTEMPTS) {
        return { placed, missing: placesWithoutProbe(garrison.armies, plan), failed: true };
      }
    }
    const { moves, missing } = planMoves(garrison.armies, plan);
    const [move] = moves;
    if (!move) return { placed, missing, failed: false };
    const form = readMoveForm(doc);
    if (!form) return { placed, missing: placesWithoutProbe(garrison.armies, plan), failed: true };

    await fetchFn(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: moveBody(form, move),
      credentials: "include",
    });
    sent = { move, before: garrison.armies[move.to][move.unit] ?? 0 };
  }
  return { placed, missing: [], failed: true };
}

// Set when the player sends an attack from the game's form: the probes are put back on the next page.
const PENDING_KEY = "optizzz:probes:pending";

export function markProbesPending(session: Storage): void {
  session.setItem(PENDING_KEY, "1");
}

/** Whether probes were marked pending, clearing the mark. */
export function takeProbesPending(session: Storage): boolean {
  const pending = session.getItem(PENDING_KEY) !== null;
  session.removeItem(PENDING_KEY);
  return pending;
}
