// Laying a template, only ever on the player's click. Form: docs/research/fourmizzz-pages.md (« Reine.php »).
import type { Place } from "@optizzz/game/army/battle";
import { UNITS } from "@optizzz/game/army/units";
import { readQueueLines } from "./pages";
import { WORKER, type LayingUnit, type TemplateLine } from "./template";

export type LaunchStatus = "pending" | "launching" | "launched" | "failed";

export interface LayingOrder {
  unit: LayingUnit;
  count: number;
  destination: Place;
}

interface LaunchOptions {
  fetchFn?: (url: string, init?: RequestInit) => Promise<Response>;
  wait?: (ms: number) => Promise<void>;
  onStatus?: (statuses: readonly LaunchStatus[]) => void;
}

/** Between two layings, as the hunt launcher does. */
const DELAY_MS = 1000;
/** The game's `destination` field: 1 Terrain, 2 Dôme, 3 Loge. */
const DESTINATION: Record<Place, string> = { field: "1", nest: "2", lodge: "3" };

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const parse = (html: string) => new DOMParser().parseFromString(html, "text/html");

/** The game's `typeUnite`: « ouvriere », « unite1 »… */
function gameType(unit: LayingUnit): string | null {
  if (unit === WORKER) return "ouvriere";
  const known = UNITS.find((candidate) => candidate.key === unit);
  return known ? `unite${String(known.field)}` : null;
}

/** The laying form's fields for this order, from a fresh page (its token `t`); null when the unit cannot be laid. */
function orderBody(doc: Document, order: LayingOrder): URLSearchParams | null {
  const type = gameType(order.unit);
  const form = [...doc.querySelectorAll<HTMLFormElement>('form[action="Reine.php"]')].find(
    (candidate) => candidate.querySelector<HTMLInputElement>('input[name="typeUnite"]')?.value === type,
  );
  // A locked unit has a form too, without the quantity field.
  const quantity = form?.querySelector<HTMLInputElement>('input[id^="input_cout_nombre"]');
  if (!form || !quantity) return null;
  const body = new URLSearchParams();
  for (const input of form.querySelectorAll<HTMLInputElement>("input[name]")) body.set(input.name, input.value);
  const count = String(order.count);
  body.set(quantity.name, count);
  body.set("nombre_de_ponte", count);
  if (body.has("destination")) body.set("destination", DESTINATION[order.destination]);
  return body;
}

/** The game queued it: a new last row of this unit, or a last row of this unit that grew. */
function queued(before: readonly TemplateLine[], after: readonly TemplateLine[], order: LayingOrder): boolean {
  const last = after.at(-1);
  if (last?.unit !== order.unit) return false;
  if (after.length > before.length) return true;
  const previous = before.at(-1);
  return previous?.unit === order.unit && last.amount > previous.amount;
}

async function launchOne(origin: string, order: LayingOrder, fetchFn: NonNullable<LaunchOptions["fetchFn"]>) {
  const url = `${origin}/Reine.php`;
  const page = parse(await fetchFn(url).then((response) => response.text()));
  const body = orderBody(page, order);
  if (!body) return false;
  const response = await fetchFn(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    credentials: "include",
  });
  return queued(readQueueLines(page), readQueueLines(parse(await response.text())), order);
}

/** One laying after the other; stops at the first failure. Resolves with each laying's status. */
export async function launchLayings(
  origin: string,
  orders: readonly LayingOrder[],
  { fetchFn = (url, init) => fetch(url, init), wait = sleep, onStatus }: LaunchOptions = {},
): Promise<LaunchStatus[]> {
  const statuses: LaunchStatus[] = orders.map(() => "pending");
  const report = () => onStatus?.(statuses);
  for (const [i, order] of orders.entries()) {
    if (i > 0) await wait(DELAY_MS);
    statuses[i] = "launching";
    report();
    const launched = await launchOne(origin, order, fetchFn).catch(() => false);
    statuses[i] = launched ? "launched" : "failed";
    report();
    if (!launched) break;
  }
  return statuses;
}
