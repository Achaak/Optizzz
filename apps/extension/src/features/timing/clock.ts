// The game's clock: a few HEAD requests, read for their `Date` header (docs/research/timing-attaques.md).
import { serverClock, type ClockSample, type ServerClock } from "@optizzz/game/timing";

/** What the measure needs from the browser: tests give their own. */
export interface ClockIo {
  fetch: (url: string, init?: RequestInit) => Promise<Response>;
  now: () => number;
  wait: (ms: number) => Promise<void>;
}

export const browserIo: ClockIo = {
  fetch: (url, init) => fetch(url, init),
  now: () => Date.now(),
  wait: (ms) =>
    new Promise((resolve) => {
      setTimeout(resolve, ms);
    }),
};

const REQUESTS = 5;
/**
 * Between two requests: not a whole second, so that they reach the server at different points of its second, and
 * the intervals each `Date` allows narrow each other down.
 */
const GAP_MS = 230;
/** A page without forms of its own to send, already read by other features: nothing changes in the game. */
const PAGE = "/Armee.php";

/** The server's clock against the PC's; null when the game gives no `Date` header. */
export async function measureServerClock(io: ClockIo): Promise<ServerClock | null> {
  const samples: ClockSample[] = [];
  for (let i = 0; i < REQUESTS; i++) {
    if (i > 0) await io.wait(GAP_MS);
    const sentAt = io.now();
    const response = await io.fetch(PAGE, { method: "HEAD", cache: "no-store" });
    const receivedAt = io.now();
    const serverDate = Date.parse(response.headers.get("date") ?? "");
    if (Number.isFinite(serverDate)) samples.push({ sentAt, receivedAt, serverDate });
  }
  return serverClock(samples);
}
