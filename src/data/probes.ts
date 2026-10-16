// Putting the probes in place with the « Déplacer son armée » form of Armee.php (docs/research/fourmizzz-pages.md),
// on the player's click or right after a hunt or an attack they sent. See docs/features/sondes.md.
import type { Place } from "@/game/army/battle";
import { UNITS } from "@/game/army/units";
import { placesWithoutProbe, probeMoves, type ProbeMove } from "@/game/probes";
import { readGarrison } from "./garrison";

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

const parse = async (response: Response) => new DOMParser().parseFromString(await response.text(), "text/html");

function moveBody(form: MoveForm, move: ProbeMove): string {
  const body = new URLSearchParams(form.hiddenFields);
  body.set("nbTroupes", "1");
  body.set("ChoixUnite", `unite${String(UNITS[move.unit]?.field ?? 0)}`);
  body.set("LieuOrigine", LIEU[move.from]);
  body.set("LieuDestination", LIEU[move.to]);
  body.set(form.submit.name, form.submit.value);
  return body.toString();
}

/** Moves one ant to each watched place without any, one move after the other, reading Armee.php afresh each time. */
export async function placeProbes(
  origin: string,
  watched: readonly Place[],
  fetchFn: FetchFn = (url, init) => fetch(url, init),
): Promise<ProbesResult> {
  const url = `${origin}/Armee.php`;
  const placed: Place[] = [];
  let doc = await parse(await fetchFn(url));
  // One move per watched place at most: never a loop if the game keeps answering the same page.
  for (let step = 0; step <= watched.length; step++) {
    const garrison = readGarrison(doc);
    if (!garrison) return { placed, missing: [...watched], failed: true };
    const { moves, missing } = probeMoves(garrison.armies, watched);
    const [move] = moves;
    if (!move) return { placed, missing, failed: false };
    const form = readMoveForm(doc);
    if (!form) return { placed, missing: placesWithoutProbe(garrison.armies, watched), failed: true };

    const response = await fetchFn(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: moveBody(form, move),
      credentials: "include",
    });
    const answer = await parse(response);
    doc = readGarrison(answer) ? answer : await parse(await fetchFn(url));
    const after = readGarrison(doc);
    if (!after || placesWithoutProbe(after.armies, [move.to]).length > 0) {
      return { placed, missing: placesWithoutProbe((after ?? garrison).armies, watched), failed: true };
    }
    placed.push(move.to);
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
