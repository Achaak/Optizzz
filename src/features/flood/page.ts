// The game's attack form (ennemie.php?Attaquer=<id>) and a player's profile. Selectors: docs/research/fourmizzz-pages.md.
import type { Place } from "@/game/army/battle";
import { emptyArmy, UNITS, type Army } from "@/game/army/units";
import { formatNumber } from "@/utils/number-format";
import { parseGameInteger } from "@/utils/game-number";

export interface AttackForm {
  target: string;
  targetId: number;
  /** My units by place, as the form's Terrain / Fourmilière / Loge columns show them. */
  available: Record<Place, number[]>;
}

const FORM_ID = "formulaireChoixArmee";
const PLACE_COLUMNS: [Place, number][] = [
  ["field", 1],
  ["nest", 2],
  ["lodge", 3],
];
const PLACE_OF_LIEU: Record<string, Place> = { "1": "field", "2": "nest", "3": "lodge" };

/** A count as the game's fields take it: « 2 000 », « 2k », « 0.1M ». */
function parseCount(text: string): number {
  const match = /^([\d\s.,]+)\s*([kKmMgG]?)/.exec(text.trim());
  if (!match?.[1]) return 0;
  const factor = { "": 1, k: 1e3, m: 1e6, g: 1e9 }[match[2]?.toLowerCase() ?? ""] ?? 1;
  const number = factor === 1 ? parseGameInteger(match[1]) : Number(match[1].replace(/\s/g, "").replace(",", "."));
  return Math.floor(number * factor);
}

const unitInputs = (doc: Document) =>
  UNITS.flatMap((unit, i) => {
    const input = doc.querySelector<HTMLInputElement>(`#${FORM_ID} input#unite${String(unit.field)}`);
    return input ? [{ i, input }] : [];
  });

export function readAttackForm(doc: Document): AttackForm | null {
  const form = doc.getElementById(FORM_ID) as HTMLFormElement | null;
  const target = form?.querySelector<HTMLInputElement>("input[name=pseudoCible]")?.value;
  const targetId = /Attaquer=(\d+)/.exec(form?.getAttribute("action") ?? "")?.[1];
  if (!form || !target || !targetId) return null;

  const available: Record<Place, number[]> = { field: emptyArmy(), nest: emptyArmy(), lodge: emptyArmy() };
  for (const row of form.querySelectorAll<HTMLTableRowElement>("#tabChoixArmee tr")) {
    const name = row.cells[0]?.textContent.replace(/['’]/g, "’").trim().toLowerCase();
    const i = UNITS.findIndex((unit) => unit.name.toLowerCase() === name);
    if (i < 0) continue;
    for (const [place, column] of PLACE_COLUMNS) {
      const counts = available[place];
      counts[i] = parseGameInteger(row.cells[column]?.textContent);
    }
  }
  return { target, targetId: Number(targetId), available };
}

/** Puts `army` in the form, every other unit at 0, and aims at the hunting field. The player sends it. */
export function fillAttackForm(doc: Document, army: Army) {
  for (const { i, input } of unitInputs(doc)) input.value = formatNumber(army[i] ?? 0);
  const place = doc.querySelector<HTMLSelectElement>(`#${FORM_ID} select#lieu`);
  if (place) place.value = "1";
}

/** Calls `sent` with the army in the form when the player submits it. Optizzz never submits anything. */
export function onAttackSent(doc: Document, sent: (attack: { army: number[]; place: Place }) => void) {
  const form = doc.getElementById(FORM_ID);
  form?.addEventListener("submit", () => {
    const army = emptyArmy();
    for (const { i, input } of unitInputs(doc)) army[i] = parseCount(input.value);
    const lieu = doc.querySelector<HTMLSelectElement>(`#${FORM_ID} select#lieu`)?.value ?? "1";
    sent({ army, place: PLACE_OF_LIEU[lieu] ?? "field" });
  });
}

/**
 * Whether the game warns that I am under the beginner protection (« Vous profitez de la protection débutant… Si vous
 * attaquez, vous ne serez plus protégés »): attacking ends it.
 */
export const isUnderBeginnerProtection = (doc: Document) =>
  /Vous profitez de la protection d[ée]butant|vous ne serez plus prot[ée]g/i.test(doc.body.textContent);
