// Launching hunts, only ever on the player's click. Form: docs/research/fourmizzz-pages.md (AcquerirTerrain.php).
import { UNITS } from "@/game/army/units";
import { readHuntForm } from "./pages";

export type LaunchStatus = "pending" | "launching" | "launched" | "failed";

export interface HuntOrder {
  amount: number;
  /** Units to send, by unit key. */
  army: Readonly<Record<string, number>>;
}

interface LaunchOptions {
  fetchFn?: (url: string, init?: RequestInit) => Promise<Response>;
  wait?: (ms: number) => Promise<void>;
  onStatus?: (statuses: readonly LaunchStatus[]) => void;
}

// Accent left out: robust to the page encoding.
const SUCCESS = "La chasse est lanc";
/** Between two hunts, as the game's other launchers do. */
const DELAY_MS = 1000;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function launchOne(origin: string, order: HuntOrder, fetchFn: NonNullable<LaunchOptions["fetchFn"]>) {
  const url = `${origin}/AcquerirTerrain.php`;
  const page = await fetchFn(url).then((response) => response.text());
  const form = readHuntForm(new DOMParser().parseFromString(page, "text/html"));
  if (!form) return false;

  const body = new URLSearchParams(form.hiddenFields);
  body.set("AcquerirTerrain", String(order.amount));
  for (const unit of UNITS) {
    const wanted = order.army[unit.key] ?? 0;
    const offered = form.available[unit.key] ?? 0;
    if (wanted > offered) return false;
    if (unit.key in form.byPlace) body.set(`unite${String(unit.field)}`, String(wanted));
  }
  body.set(form.submit.name, form.submit.value);

  const response = await fetchFn(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    credentials: "include",
  });
  return (await response.text()).includes(SUCCESS);
}

/** One hunt after the other; stops at the first failure. Resolves with each hunt's status. */
export async function launchHunts(
  origin: string,
  orders: readonly HuntOrder[],
  { fetchFn = (url, init) => fetch(url, init), wait = sleep, onStatus }: LaunchOptions = {},
): Promise<LaunchStatus[]> {
  const statuses: LaunchStatus[] = orders.map(() => "pending");
  const report = () => onStatus?.(statuses);
  for (const [i] of orders.entries()) {
    if (i > 0) await wait(DELAY_MS);
    statuses[i] = "launching";
    report();
    const order = orders[i];
    const launched = order ? await launchOne(origin, order, fetchFn).catch(() => false) : false;
    statuses[i] = launched ? "launched" : "failed";
    report();
    if (!launched) break;
  }
  return statuses;
}
