// Reading game pages for the hunt launcher. Selectors: docs/research/fourmizzz-pages.md.
import { UNITS } from "./engine/units";

const toInteger = (text: string | null | undefined) => Number((text ?? "").replace(/\D/g, "")) || 0;

export interface UnitPlaces {
  field: number;
  nest: number;
  lodge: number;
}

export interface HuntForm {
  /** Units the game lets go hunting, by unit key (hunting field + nest + lodge). */
  available: Record<string, number>;
  byPlace: Record<string, UnitPlaces>;
  /** Hidden inputs (token…) to post back as they are. */
  hiddenFields: Record<string, string>;
  submit: { name: string; value: string };
}

/** The army step of AcquerirTerrain.php: a GET gives the full form. */
export function readHuntForm(doc: Document): HuntForm | null {
  const form = doc.querySelector<HTMLFormElement>('form[action="AcquerirTerrain.php"]');
  const table = form?.querySelector("#tabChoixArmee");
  const submit = form?.querySelector<HTMLInputElement>('input[type="submit"][name]');
  if (!form || !table || !submit) return null;

  const available = Object.fromEntries(UNITS.map((unit) => [unit.key, 0]));
  const byPlace: Record<string, UnitPlaces> = {};
  for (const row of table.querySelectorAll("tr")) {
    const input = row.querySelector<HTMLInputElement>('input[name^="unite"]');
    const unit = UNITS.find((candidate) => input?.name === `unite${String(candidate.field)}`);
    if (!input || !unit) continue;
    const [, field, nest, lodge] = [...row.cells].map((cell) => toInteger(cell.textContent));
    byPlace[unit.key] = { field: field ?? 0, nest: nest ?? 0, lodge: lodge ?? 0 };
    available[unit.key] = toInteger(input.value);
  }

  const hiddenFields = Object.fromEntries(
    [...form.querySelectorAll<HTMLInputElement>('input[type="hidden"][name]')].map((input) => [
      input.name,
      input.value,
    ]),
  );
  return { available, byPlace, hiddenFields, submit: { name: submit.name, value: submit.value } };
}

export interface OngoingHunt {
  id: string;
  fieldGain: number;
  returnsAt: Date;
  /** Troops away, by unit key: shown with Compte+ only. */
  troops: Record<string, number> | null;
}

const normalize = (text: string) => text.replace(/['’]/g, "’").trim().toLowerCase();

/** « 1 975 Jeunes Soldates Naines, 124 Soldates Naines. » → { JSN: 1975, SN: 124 } */
export function readTroops(text: string): Record<string, number> {
  const troops: Record<string, number> = {};
  for (const part of text.replace(/\.\s*$/, "").split(",")) {
    const match = /^\s*([\d\s]+?)\s+(\D+)$/.exec(part);
    if (!match?.[1] || !match[2]) continue;
    const name = normalize(match[2]);
    const unit = UNITS.find((candidate) => normalize(candidate.plural) === name || normalize(candidate.name) === name);
    if (unit) troops[unit.key] = (troops[unit.key] ?? 0) + toInteger(match[1]);
  }
  return troops;
}

function remainingSeconds(doc: Document, id: string): number | null {
  const pattern = new RegExp(`reste\\((\\d+),\\s*"${id}"\\)`);
  for (const script of doc.querySelectorAll("script")) {
    const match = pattern.exec(script.textContent);
    if (match?.[1]) return Number(match[1]);
  }
  return null;
}

/** Hunts running, from Ressources.php: « - Vos chasseuses vont conquérir 122 cm² dans … ». */
export function readOngoingHunts(doc: Document, now: Date): OngoingHunt[] {
  return [...doc.querySelectorAll('span[id^="chasse_"]')].flatMap((countdown) => {
    const line = countdown.parentElement;
    const gain = /conquérir\s+([\d\s]+)\s*cm/.exec(line?.textContent ?? "");
    const seconds = remainingSeconds(doc, countdown.id);
    if (!gain?.[1] || seconds === null) return [];
    return [
      {
        id: countdown.id,
        fieldGain: toInteger(gain[1]),
        returnsAt: new Date(now.getTime() + seconds * 1000),
        troops: troopsAfter(line),
      },
    ];
  });
}

/** The Compte+ « Troupes en chasses : … » note that follows a hunt line, before the next hunt. */
function troopsAfter(line: Element | null): Record<string, number> | null {
  for (let next = line?.nextElementSibling; next; next = next.nextElementSibling) {
    if (next.querySelector('span[id^="chasse_"]')) return null;
    const match = /Troupes en chasses\s*:\s*([^\n]+?\.)/.exec(next.textContent);
    if (match?.[1]) return readTroops(match[1]);
  }
  return null;
}
