// The watch list's summary at the top of the toolbar popup: one line per server, the latest changes under it.
import { loadWatchlist, watchedHosts } from "@/data/watchlist";
import { loadJournal, loadWatchState, originOf } from "./reading";
import { summarize, type ServerSummary } from "./summary";

export const WATCH_SUMMARY_STYLE = `
.watch-summary { margin: 0 var(--optizzz-space-6) var(--optizzz-space-4); padding: var(--optizzz-space-4) var(--optizzz-space-5); }
.watch-summary-server { display: flex; justify-content: space-between; gap: var(--optizzz-space-4); align-items: baseline; }
.watch-summary ul { margin: var(--optizzz-space-2) 0 0; padding: 0; list-style: none; font-size: var(--optizzz-font-size-small); }
.watch-summary li + li { margin-top: var(--optizzz-space-1); }
.watch-summary-server + .watch-summary-server, ul + .watch-summary-server { margin-top: var(--optizzz-space-3); }`;

export interface ServerWatch {
  /** « S5 ». */
  server: string;
  origin: string;
  summary: ServerSummary;
}

/** The summary of each server whose list is not empty. */
export async function loadWatchSummaries(now: Date): Promise<ServerWatch[]> {
  return Promise.all(
    (await watchedHosts()).sort().map(async (host) => ({
      server: (host.split(".")[0] ?? host).toUpperCase(),
      origin: await originOf(host),
      summary: summarize(await loadWatchlist(host), await loadJournal(host), await loadWatchState(host), now),
    })),
  );
}

/** Null without any watched server. `open` opens the game on the « Suivis » view. */
export function buildWatchSummary(
  doc: Document,
  servers: readonly ServerWatch[],
  open: (origin: string) => void,
): HTMLElement | null {
  if (servers.length === 0) return null;
  const box = doc.createElement("section");
  box.className = "watch-summary optizzz-well";
  box.setAttribute("aria-label", "Suivis");
  for (const { server, origin, summary } of servers) {
    const line = doc.createElement("div");
    line.className = "watch-summary-server";
    const text = doc.createElement("span");
    const name = doc.createElement("b");
    name.textContent = `Suivis ${server}`;
    text.append(name, " : ");
    if (summary.newCount > 0) text.append(`${String(summary.newCount)} avec du nouveau`);
    else {
      const quiet = doc.createElement("span");
      quiet.className = "optizzz-muted";
      quiet.textContent = "rien de nouveau";
      text.append(quiet);
    }
    const button = doc.createElement("button");
    button.type = "button";
    button.className = "optizzz-button-link";
    button.textContent = "Ouvrir";
    button.addEventListener("click", () => {
      open(origin);
    });
    line.append(text, button);
    box.append(line);
    if (summary.latest.length > 0) {
      const list = doc.createElement("ul");
      for (const change of summary.latest) {
        const item = doc.createElement("li");
        item.textContent = change;
        list.append(item);
      }
      box.append(list);
    }
  }
  return box;
}
